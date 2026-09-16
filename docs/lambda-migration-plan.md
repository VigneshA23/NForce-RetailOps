# Lambda Migration Plan — RetailOps Backend

## Summary & Recommendation

Migrate the Spring Boot backend from Railway to AWS Lambda using the `aws-serverless-java-container-springboot3` library (Amazon's official Spring Boot 3 adapter). This is a thin wrapper approach: existing controllers, services, and repositories need no changes. The only new code is one handler class and five internal HTTP endpoints to replace the five `@Scheduled` methods.

Key decisions, all matching the tracktion-api reference:
- **Function URL** (not API Gateway) — simpler, no per-request pricing
- **No VPC** — retailops-db is publicly accessible; Lambda connects to RDS over the internet exactly as Railway did
- **On-demand only** (no provisioned concurrency) — mitigated by a 5-minute warm-up ping from EventBridge during business hours
- **Scheduled jobs via EventBridge Scheduler → Function URL HTTP** with a shared secret header (same DIGEST_CRON_SECRET pattern as tracktion-api)
- **S3 upload required** — built JAR is 71.3MB, exceeding the 50MB direct-upload limit

At our actual traffic volume (a few hundred requests/day), monthly compute cost is effectively **$0** — well inside Lambda's free tier at both 512MB and 1024MB. Use 1024MB anyway: the JVM, Hibernate context, and Apache POI need the headroom, and the dollar difference is zero.

---

## Part 1 — Current State

### Scheduled Methods (5 total)

The user's brief named two SA notification jobs. There are actually five:

| Service | Cron / interval | Method | What it does |
|---|---|---|---|
| `SuperAdminAlertService` | `0 0 20 * * ?` (8pm daily) | `runZeroActivityCheck()` | For each active store with zero task responses today, fires one `STORE_ZERO_ACTIVITY` notification to every Super Admin. Dedup-guarded per SA per day. |
| `SuperAdminAlertService` | `0 0 9 * * ?` (9am daily) | `runOverdueIssuesCheck()` | For each store with OPEN issues older than 48h, fires one aggregated `ISSUES_OVERDUE` notification per SA. Dedup-guarded per SA per store per day. |
| `RaisedIssueService` | `0 0 3 * * *` (3am daily) | `purgeOldResolvedIssues()` | Hard-deletes resolved issues older than 7 days from `raised_issues`. |
| `TaskService` | `0 0 3 * * *` (3am daily) | `deactivateTasksPastEndDate()` | Sets `active = false` on tasks whose `end_date` has passed. |
| `LoginRateLimitService` | `PT1H` (every hour) | `purgeExpiredAttempts()` | Deletes rows from `login_attempts` older than 2× the rate-limit window. Keeps the table small without manual intervention. |

There is also an `@EventListener(ApplicationReadyEvent.class)` in `TaskService.deactivateTasksPastEndDateOnStartup()` that calls `deactivateTasksPastEndDate()` on every cold start. On Lambda this runs on every cold start — this is acceptable behaviour (fast lightweight query) and does not need to be removed.

### Application Entry Point

`RetailOpsApplication.java` — standard `SpringApplication.run()` with `@EnableScheduling`. No custom servlet config, no `SpringApplicationBuilder` customization.

### Dependencies — Lambda Compatibility

| Dependency | Lambda concern | Verdict |
|---|---|---|
| `spring-boot-starter-web` (Tomcat embedded) | Lambda has no open ports; embedded Tomcat is replaced by the container adapter | Handled by adapter — Tomcat excluded in Lambda build |
| `spring-boot-starter-data-jpa` (Hibernate) | No issues | Fine |
| `spring-boot-starter-security` | No issues | Fine |
| `spring-dotenv` | Looks for `backend/.env` on startup; no `.env` exists on Lambda | Gracefully skips if file absent — confirmed by library source. All values supplied as Lambda env vars. |
| `poi` + `poi-ooxml` (Apache POI) | POI OOXML writes temp files to `java.io.tmpdir` | Lambda's `/tmp` is writable (512MB default, configurable to 10GB). No issue. |
| `flyway-core` | Runs migrations on every cold start | Fine — Flyway is idempotent. With schema already at V53, "Schema is up to date" takes ~0.7s. |
| `spring-boot-starter-actuator` | `/actuator/health` exposed | Fine — used as warm-up ping target. |
| No WebSocket, no NIO file-watchers, no `SecurityManager` usage | — | No Lambda incompatibilities found. |

### Built JAR Size

```
target/retailops-0.1.0.jar   71.3MB
```

**Exceeds the 50MB direct zip upload limit.** S3-based deployment is required. See Part 7.

---

## Part 2 — Packaging Approach

Use `aws-serverless-java-container-springboot3` (Amazon's official library, v2.x).

**Why this over Spring Cloud Function AWS adapter:**
- Spring Cloud Function requires restructuring handlers as `Function<I,O>` beans and changes how the app is wired; existing controllers must be adapted.
- `aws-serverless-java-container` wraps the existing `DispatcherServlet` behind a `RequestStreamHandler`. No controller or service changes. The handler class is the only new file.
- Spring Cloud Function is the right choice when the Lambda IS the function; here the Lambda is a full Spring Boot API that happens to run on Lambda.

**Build change required:** The standard Spring Boot fat JAR uses nested JARs (`BOOT-INF/lib/*.jar`) which Lambda's Java runtime ClassLoader cannot load. Add `maven-shade-plugin` to produce a flat uber-JAR where all dependency classes are expanded at the top level. The `spring-boot-maven-plugin` is kept for local `mvn spring-boot:run`; the shade plugin produces the separate Lambda-deployable artifact.

---

## Part 3 — Scheduled Jobs: Shared-Secret Internal Endpoints

### Design

Remove `@EnableScheduling` from `RetailOpsApplication.java`. Create a new `InternalJobController` with five endpoints, each requiring an `X-Internal-Job-Secret` header matching the `INTERNAL_JOB_SECRET` environment variable. Return `401` if the header is absent, `403` if the value is wrong. These are secured by Spring Security as authenticated-only routes — the secret header check is an additional guard on top, handled in the controller.

Actually: since the Function URL has `AuthType: NONE`, Spring Security's existing `JwtAuthenticationFilter` will reject any request without a JWT. The internal job endpoints must be added to the `permitAll()` list in `SecurityConfig` (alongside `/api/auth/**`) so EventBridge can reach them without a JWT. The `X-Internal-Job-Secret` check inside the controller is the sole auth mechanism for these endpoints.

```
POST /internal/jobs/zero-activity-check      → SuperAdminAlertService.runZeroActivityCheck()
POST /internal/jobs/overdue-issues-check     → SuperAdminAlertService.runOverdueIssuesCheck()
POST /internal/jobs/nightly-maintenance      → purgeOldResolvedIssues() + deactivateTasksPastEndDate() (both 3am, grouped)
POST /internal/jobs/purge-login-attempts     → LoginRateLimitService.purgeExpiredAttempts()
```

The two 3am jobs are grouped under one `/internal/jobs/nightly-maintenance` endpoint to keep EventBridge rules minimal (one 3am rule instead of two).

### EventBridge Scheduler Setup (4 rules)

Each rule uses an **API Destination** (not direct Lambda invoke). The API Destination stores the Function URL base path + the `X-Internal-Job-Secret` connection header — EventBridge injects the header on every call without it appearing in rule config.

| Schedule | Cron (UTC) | Endpoint |
|---|---|---|
| Overdue issues check | `cron(0 9 * * ? *)` | `POST /internal/jobs/overdue-issues-check` |
| Zero activity check | `cron(0 20 * * ? *)` | `POST /internal/jobs/zero-activity-check` |
| Nightly maintenance | `cron(0 3 * * ? *)` | `POST /internal/jobs/nightly-maintenance` |
| Login attempt cleanup | `rate(1 hour)` | `POST /internal/jobs/purge-login-attempts` |

**Note on timezones:** The current cron expressions use server local time (Railway was probably UTC or US/Eastern). The two SA notification jobs (8pm zero-activity, 9am overdue) need to fire at a time meaningful to the client (Keds Ice Cream). Confirm timezone before setting EventBridge crons — EventBridge Scheduler supports timezone-aware crons natively.

### Same Lambda Function

All five endpoints are in the same `InternalJobController` inside the same deployed Lambda function. No separate deployable, no separate Lambda. The fully-initialized Spring context handles job requests identically to API requests — same DB connection, same service layer.

---

## Part 4 — Function URL + Networking

**Function URL** (`AuthType: NONE`) — matches tracktion-api. Spring Security handles all auth internally (JWT verification for API routes, shared-secret header for internal job routes). CORS must be configured at the Function URL level (not API Gateway) — set `AllowOrigins` to the Vercel frontend URL.

**No VPC.** `retailops-db.cjcwmyi0kh8z.us-east-2.rds.amazonaws.com` is publicly accessible (confirmed during RDS connectivity test). Lambda connects to it over the internet on port 5432, exactly as Railway did. VPC would add ~10-15 seconds cold-start latency (ENI attachment), cost money for NAT Gateway, and provide no security benefit given the DB is already public with password auth + SSL. Explicitly: do not add a VPC.

---

## Part 5 — Memory and Cost

### Memory: 1024MB

Spring Boot 3 + Hibernate + Flyway + Apache POI + connection pool on a cold JVM consumes roughly 350–500MB at peak during initialization. At 512MB, cold starts may OOM or GC-stall mid-initialization. At 1024MB there is comfortable headroom for the JVM heap, metaspace, Hibernate's schema cache, and POI's in-memory workbook construction during Excel export.

### Cost at Actual Traffic (few hundred requests/day, 2-3 stores)

**Assumptions:** 300 requests/day = 9,000 requests/month. Average request duration (warmed): 250ms. Average cold-start duration: 8,000ms. Estimated cold starts per month: ~50 (one per business-hours interval after overnight gap, plus random idle periods). Warm-up pings (see below): 4,032/month.

| Item | 512MB | 1024MB |
|---|---|---|
| Compute (warmed requests) | 9,000 × 0.25s × 0.5GB = **1,125 GB-s** | 9,000 × 0.25s × 1GB = **2,250 GB-s** |
| Compute (cold starts) | 50 × 8s × 0.5GB = **200 GB-s** | 50 × 8s × 1GB = **400 GB-s** |
| Compute (warm-up pings) | 4,032 × 0.1s × 0.5GB = **202 GB-s** | 4,032 × 0.1s × 1GB = **403 GB-s** |
| **Total GB-seconds** | **1,527** | **3,053** |
| **Lambda free tier** | 400,000 GB-s/month | 400,000 GB-s/month |
| **Billable GB-seconds** | 0 (well inside free tier) | 0 (well inside free tier) |
| **Request cost** | 9,000 + 4,032 = 13,032 reqs → $0 (free tier: 1M/month) | same → $0 |
| **Monthly total** | **$0.00** | **$0.00** |

**Dollar difference between 512MB and 1024MB at this traffic: $0.00.**

Even after free tier exhaustion (unlikely at this scale): 3,053 GB-s × $0.0000166667 = **$0.051/month** at 1024MB vs $0.025/month at 512MB — a $0.026/month difference. Use 1024MB; the cost is identical and the stability benefit is real.

### Warm-Up Ping (Cold Start Mitigation)

EventBridge rule: `rate(5 minutes)` with a time-window condition, active 07:00–23:00 local time (16 hours/day). Calls `GET /actuator/health` on the Function URL. Lambda's health check response is instant (<50ms) on a warm container.

- Ping count: 12/hour × 16h × 30 days = **5,760 pings/month**
- EventBridge Scheduler cost: $1.00/million invocations → **$0.006/month**
- Lambda compute: 5,760 × 0.05s × 1GB = 288 GB-s → absorbed in free tier → **$0.00**
- **Total warm-up cost: ~$0.006/month**

Outside business hours (11pm–7am) cold starts are acceptable — the stores aren't active, and the scheduled jobs (3am, 9am) will trigger their own warm containers.

---

## Part 6 — Environment Variables

All set in Lambda configuration. No `.env` file on Lambda — `spring-dotenv` skips gracefully when the file is absent.

| Variable | Value / source |
|---|---|
| `DATABASE_URL` | `jdbc:postgresql://retailops-db.cjcwmyi0kh8z.us-east-2.rds.amazonaws.com:5432/retailopsdb?sslmode=require` |
| `DATABASE_USERNAME` | `postgres` |
| `DATABASE_PASSWORD` | (from RDS setup — store in AWS Secrets Manager, reference via Lambda env) |
| `JWT_SECRET` | Same value as current Railway deployment |
| `JWT_EXPIRATION_MS` | `86400000` |
| `RESEND_API_KEY` | Same as current |
| `RESEND_FROM_EMAIL` | `noreply@nforceretailops.online` |
| `APP_BASE_URL` | Vercel frontend URL (used in password-reset email links) |
| `FRONTEND_URL` | Vercel frontend URL (CORS allowed origin) |
| `INTERNAL_JOB_SECRET` | New — a random 32+ char secret, also stored in EventBridge Connection config |
| `LOGIN_RATE_LIMIT_ENABLED` | `true` |
| `PORT` | Not needed — Lambda adapter does not start an HTTP server on a port |
| `DB_POOL_MAX_SIZE` | `3` (Lambda containers are single-threaded per invocation; a pool >3 wastes connections on RDS's connection limit) |

**Note on `DB_POOL_MAX_SIZE`:** Railway used 10 (default). Lambda runs one request per container instance concurrently. With up to ~10 concurrent Lambda instances at peak (very unlikely at our traffic), a pool of 3 per instance means max 30 connections to RDS. RDS PostgreSQL default max_connections is 100 — this is safe. Set pool min=1 to release idle connections quickly between invocations.

---

## Part 7 — Deployment Mechanism

**Manual console-based deployment for this first pass.**

### Build Command

```bash
mvn clean package -DskipTests
```

With the shade plugin configured (see code changes below), this produces two artifacts:
- `target/retailops-0.1.0.jar` — Spring Boot fat JAR (for local `spring-boot:run`)
- `target/retailops-0.1.0-lambda.jar` — flat uber-JAR (for Lambda deployment)

### S3 Upload Required

The Lambda JAR will be approximately 71MB (same dependencies, flat layout). Direct zip upload limit is 50MB. Upload to an S3 bucket in `us-east-2` (same region as Lambda and RDS):

```
s3://nforce-retailops-lambda-deploy/retailops-lambda.jar
```

Create this bucket if it doesn't exist. Block all public access. Lambda's execution role needs `s3:GetObject` on this bucket.

### Lambda Console Steps (summary — detail in checklist below)

1. Create S3 bucket, upload JAR
2. Create Lambda function: Java 17 runtime, `com.nforce.retailops.LambdaHandler::handleRequest` handler
3. Set memory 1024MB, timeout 30s (long enough for cold start + Flyway check)
4. Set all environment variables
5. Enable Function URL (`AuthType: NONE`, CORS configured)
6. Create EventBridge Connection (stores `X-Internal-Job-Secret` header)
7. Create 4 EventBridge API Destinations + Scheduler rules
8. Create warm-up ping rule

---

## Precise Ordered Checklist

### Code Changes (in order)

**1. `pom.xml` — add `maven-shade-plugin` for Lambda uber-JAR**
Add inside `<build><plugins>`:
```xml
<plugin>
  <groupId>org.apache.maven.plugins</groupId>
  <artifactId>maven-shade-plugin</artifactId>
  <version>3.6.0</version>
  <configuration>
    <createDependencyReducedPom>false</createDependencyReducedPom>
    <shadedArtifactAttached>true</shadedArtifactAttached>
    <shadedClassifierName>lambda</shadedClassifierName>
    <filters>
      <filter>
        <artifact>*:*</artifact>
        <excludes>
          <exclude>META-INF/*.SF</exclude>
          <exclude>META-INF/*.DSA</exclude>
          <exclude>META-INF/*.RSA</exclude>
        </excludes>
      </filter>
    </filters>
    <transformers>
      <transformer implementation="org.apache.maven.plugins.shade.resource.AppendingTransformer">
        <resource>META-INF/spring.handlers</resource>
      </transformer>
      <transformer implementation="org.apache.maven.plugins.shade.resource.AppendingTransformer">
        <resource>META-INF/spring.schemas</resource>
      </transformer>
      <transformer implementation="org.apache.maven.plugins.shade.resource.ServicesResourceTransformer"/>
      <transformer implementation="org.apache.maven.plugins.shade.resource.ManifestResourceTransformer">
        <mainClass>com.nforce.retailops.RetailOpsApplication</mainClass>
      </transformer>
    </transformers>
  </configuration>
  <executions>
    <execution>
      <phase>package</phase>
      <goals><goal>shade</goal></goals>
    </execution>
  </executions>
</plugin>
```

**2. `pom.xml` — add `aws-serverless-java-container-springboot3` dependency**
```xml
<dependency>
  <groupId>com.amazonaws.serverless</groupId>
  <artifactId>aws-serverless-java-container-springboot3</artifactId>
  <version>2.0.3</version>
</dependency>
```

**3. New file: `src/main/java/com/nforce/retailops/LambdaHandler.java`**
Lambda entry point. Implements `RequestStreamHandler`. Uses `SpringBootProxyHandlerBuilder` from the adapter library to initialize the Spring context and proxy requests to `DispatcherServlet`. Configure with async init to reduce cold-start latency (context initialization happens in a background thread during the Lambda init phase, not blocking the first request). No other code changes.

**4. `RetailOpsApplication.java` — remove `@EnableScheduling`**
The annotation is no longer needed. `@Scheduled` methods are kept in service classes (they are harmless when scheduling is disabled — Spring simply never calls them) but they will never fire in Lambda. The new internal endpoints in step 5 replace them.

**5. New file: `src/main/java/com/nforce/retailops/controller/InternalJobController.java`**
`@RestController` mapping `/internal/jobs/**`. Four endpoints:
- `POST /internal/jobs/zero-activity-check`
- `POST /internal/jobs/overdue-issues-check`
- `POST /internal/jobs/nightly-maintenance`
- `POST /internal/jobs/purge-login-attempts`

Each reads `X-Internal-Job-Secret` from the request header, compares to `${INTERNAL_JOB_SECRET}` env var, returns `403` if mismatch. On success calls the corresponding service method and returns `200 OK`.

**6. `config/SecurityConfig.java` — add `/internal/jobs/**` to `permitAll()`**
These endpoints must be reachable by EventBridge without a JWT. Add `/internal/jobs/**` alongside `/api/auth/**` in the `requestMatchers(...).permitAll()` block. The shared-secret header check in the controller is the sole auth for these routes.

**7. `application.yml` — add Lambda profile or conditional server config**
Set `server.port` to a fixed value (e.g. 8080) so the adapter can locate Tomcat consistently. Optionally add a `lambda` Spring profile that sets `hikari.minimum-idle=1` and `hikari.maximum-pool-size=3` (override `DB_POOL_MAX_SIZE`).

That is all code changes. No controllers, services, repositories, DTOs, or migration files change.

---

### AWS Console Steps (in order)

**Step 1 — S3 bucket**
- Create bucket: `nforce-retailops-lambda-deploy`, region `us-east-2`
- Block all public access: enabled
- Upload `target/retailops-0.1.0-lambda.jar` as `retailops-lambda.jar`

**Step 2 — IAM execution role**
- Create role: `retailops-lambda-execution-role`
- Attach: `AWSLambdaBasicExecutionRole` (CloudWatch Logs)
- Add inline policy: `s3:GetObject` on the deploy bucket (for initial deployment; can be removed after)
- Add inline policy: `rds-db:connect` is not needed (we use password auth, not IAM auth)

**Step 3 — Create Lambda function**
- Runtime: Java 17
- Architecture: x86_64 (arm64/Graviton2 would be ~20% cheaper but requires verifying all dependencies support it — defer to a later optimization)
- Handler: `com.nforce.retailops.LambdaHandler::handleRequest`
- Memory: 1024MB
- Ephemeral storage: 512MB (default — sufficient for POI temp files)
- Timeout: 30 seconds
- Execution role: `retailops-lambda-execution-role`
- Code source: Upload from S3 → `s3://nforce-retailops-lambda-deploy/retailops-lambda.jar`

**Step 4 — Set environment variables**
Set all 11 variables from Part 6 in the Lambda configuration → Environment variables panel. Do not set `PORT`.

**Step 5 — Enable Function URL**
- Auth type: `NONE`
- CORS: Allow origin = Vercel frontend URL, Allow methods = `*`, Allow headers = `Content-Type, Authorization`, Max age = 300

**Step 6 — Test cold start**
Invoke the Function URL with a `GET /actuator/health` request. First invocation will cold-start (~8-15s). Confirm `{"status":"UP"}`. Check CloudWatch Logs for Flyway output confirming schema is up to date.

**Step 7 — EventBridge Connection**
- Name: `retailops-internal-job-connection`
- Auth type: API Key
- API Key name: `X-Internal-Job-Secret`
- API Key value: the `INTERNAL_JOB_SECRET` value

**Step 8 — EventBridge API Destinations (4)**
For each endpoint, create one API Destination pointing to the Function URL:
- `retailops-zero-activity` → `POST https://<function-url-id>.lambda-url.us-east-2.on.aws/internal/jobs/zero-activity-check`
- `retailops-overdue-issues` → `POST https://<function-url-id>.lambda-url.us-east-2.on.aws/internal/jobs/overdue-issues-check`
- `retailops-nightly-maintenance` → `POST https://<function-url-id>.lambda-url.us-east-2.on.aws/internal/jobs/nightly-maintenance`
- `retailops-purge-login-attempts` → `POST https://<function-url-id>.lambda-url.us-east-2.on.aws/internal/jobs/purge-login-attempts`
- All use the `retailops-internal-job-connection` connection

**Step 9 — EventBridge Scheduler rules (4 job rules)**
In EventBridge Scheduler (not EventBridge Events):
- `retailops-zero-activity`: `cron(0 20 * * ? *)` — timezone: confirm with client — target: `retailops-zero-activity` API Destination
- `retailops-overdue-issues`: `cron(0 9 * * ? *)` — same timezone — target: `retailops-overdue-issues` API Destination
- `retailops-nightly-maintenance`: `cron(0 3 * * ? *)` — UTC is fine for 3am maintenance — target: `retailops-nightly-maintenance` API Destination
- `retailops-purge-login-attempts`: `rate(1 hour)` — target: `retailops-purge-login-attempts` API Destination

**Step 10 — Warm-up ping rule**
EventBridge Scheduler rule: `rate(5 minutes)`, with flexible time window off.
- Target: `retailops-zero-activity` API Destination pointing to `GET /actuator/health` (create a fifth API Destination for this, or use a Lambda target that calls the Function URL)
- Alternatively: create a separate API Destination for health ping: `GET https://<function-url-id>.lambda-url.us-east-2.on.aws/actuator/health`
- No secret header needed (health endpoint is public)
- Note: Active only 07:00–23:00 local time — EventBridge Scheduler supports time-window conditions; configure `StartDate`/`EndDate` per day is not native but can be achieved with a Lambda-based scheduler or simply accept 24h pings (~288/day = 8,640/month — still free tier)

**Step 11 — Update frontend**
Change `VITE_API_BASE_URL` (or equivalent) in the Vercel frontend environment variables from the Railway URL to the Lambda Function URL. Deploy.

**Step 12 — Decommission Railway**
Once the Lambda deployment is confirmed working with real traffic (give it 24h), delete the Railway service. Railway billing stops immediately on delete.

---

## Open Questions Before Execution

1. **Timezone for SA notification jobs**: What local timezone should 8pm (zero-activity) and 9am (overdue-issues) fire in? Client is presumably US-based — confirm EST/EDT or CST/CDT before setting EventBridge crons.
2. **`spring-dotenv` on Lambda**: Confirm that v4.0.0 skips gracefully when no `.env` file exists. If it throws on missing file, add a conditional or remove the dependency (Lambda needs no `.env` — all vars are in Lambda config).
3. **Graviton2 (arm64)**: A future cost optimization — 20% cheaper per GB-second. Defer until the x86_64 deployment is stable and verified.
4. **Secrets Manager**: For production hardening, `DATABASE_PASSWORD` and `INTERNAL_JOB_SECRET` should be stored in AWS Secrets Manager and fetched at Lambda init time rather than plain Lambda env vars. Implement after initial working deployment.
