package com.nforce.retailops.config;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Activates Spring's @Scheduled infrastructure only when app.scheduling.enabled
 * is true (the default). Set APP_SCHEDULING_ENABLED=false in a Lambda deployment's
 * environment variables to disable all in-process scheduled jobs — EventBridge
 * Scheduler calls the /internal/jobs/** endpoints instead.
 *
 * Safety property: if this branch's code is ever merged to dev/main without
 * APP_SCHEDULING_ENABLED being explicitly set in Railway, scheduling continues
 * to work exactly as it does today. The Lambda-specific behaviour only activates
 * when APP_SCHEDULING_ENABLED=false is deliberately set in Lambda's config.
 */
@Configuration
@ConditionalOnProperty(name = "app.scheduling.enabled", havingValue = "true", matchIfMissing = true)
@EnableScheduling
public class SchedulingConfig {
}
