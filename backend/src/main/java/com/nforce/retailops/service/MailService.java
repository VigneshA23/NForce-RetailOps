package com.nforce.retailops.service;

import com.nforce.retailops.exception.EmailDeliveryException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.ses.SesClient;
import software.amazon.awssdk.services.ses.model.Body;
import software.amazon.awssdk.services.ses.model.Content;
import software.amazon.awssdk.services.ses.model.Destination;
import software.amazon.awssdk.services.ses.model.Message;
import software.amazon.awssdk.services.ses.model.SendEmailRequest;
import software.amazon.awssdk.services.ses.model.SesException;

import org.springframework.beans.factory.annotation.Autowired;

import java.util.List;
import java.util.Map;

@Service
public class MailService {

    private static final Logger log = LoggerFactory.getLogger(MailService.class);

    /**
     * Abstraction over the actual sending mechanism. Implementations throw
     * EmailDeliveryException on failure; callers never see provider-specific exceptions.
     */
    @FunctionalInterface
    interface EmailTransport {
        void deliver(String to, String subject, String html);
    }

    private final EmailTransport transport;

    @Autowired
    public MailService(
        @Value("${resend.api-key:}") String resendApiKey,
        @Value("${resend.from-email}") String resendFromEmail,
        @Value("${ses.from-email:noreply@nforceone.com}") String sesFromEmail
    ) {
        boolean isLambda = isLambdaEnvironment();
        log.info("MailService: provider={}", isLambda ? "SES (us-east-1)" : "Resend");
        this.transport = isLambda
            ? buildSesTransport(sesFromEmail)
            : buildResendTransport(resendApiKey, resendFromEmail);
    }

    // Package-private: lets tests inject a capture transport without touching real providers.
    MailService(EmailTransport transport) {
        this.transport = transport;
    }

    // Package-private: exposed so tests can assert provider selection without env-var gymnastics.
    static boolean isLambdaEnvironment() {
        return System.getenv("AWS_LAMBDA_FUNCTION_NAME") != null;
    }

    private static EmailTransport buildResendTransport(String apiKey, String fromEmail) {
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(3_000);
        requestFactory.setReadTimeout(5_000);
        RestClient client = RestClient.builder()
            .baseUrl("https://api.resend.com")
            .defaultHeader("Authorization", "Bearer " + apiKey)
            .requestFactory(requestFactory)
            .build();

        return (to, subject, html) -> {
            try {
                client.post()
                    .uri("/emails")
                    .body(Map.of(
                        "from", fromEmail,
                        "to", List.of(to),
                        "subject", subject,
                        "html", html
                    ))
                    .retrieve()
                    .toBodilessEntity();
            } catch (RestClientException ex) {
                log.error("Resend send failed for {}", to, ex);
                String detail = ex instanceof RestClientResponseException r
                    ? r.getResponseBodyAsString()
                    : ex.getMessage();
                throw new EmailDeliveryException("Failed to send the account email to " + to + ": " + detail);
            }
        };
    }

    private static EmailTransport buildSesTransport(String fromEmail) {
        // Credentials come from the Lambda execution role via the default provider chain.
        // No explicit access key needed in code — IAM role attached to the function handles auth.
        SesClient ses = SesClient.builder()
            .region(Region.US_EAST_1)
            .build();

        return (to, subject, html) -> {
            try {
                ses.sendEmail(SendEmailRequest.builder()
                    .source(fromEmail)
                    .destination(Destination.builder().toAddresses(to).build())
                    .message(Message.builder()
                        .subject(Content.builder().data(subject).charset("UTF-8").build())
                        .body(Body.builder()
                            .html(Content.builder().data(html).charset("UTF-8").build())
                            .build())
                        .build())
                    .build());
            } catch (SesException ex) {
                log.error("SES send failed for {}", to, ex);
                throw new EmailDeliveryException(
                    "Failed to send the account email to " + to + ": " + ex.awsErrorDetails().errorMessage());
            }
        };
    }

    private void send(String toEmail, String subject, String html) {
        transport.deliver(toEmail, subject, html);
    }

    public void sendAccountSetupEmail(String toEmail, String fullName, String setupLink) {
        String html = """
            <!DOCTYPE html>
            <html lang="en">
            <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
            <body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
              <table width="100%%" cellpadding="0" cellspacing="0" role="presentation" style="background:#f1f5f9;padding:40px 16px;">
                <tr><td align="center">
                  <table width="560" cellpadding="0" cellspacing="0" role="presentation" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
                    <tr><td style="background:#10A3A8;padding:28px 40px;text-align:center;">
                      <div style="font-size:20px;font-weight:800;color:#ffffff;letter-spacing:-0.3px;">NForce RetailOps</div>
                      <div style="font-size:12px;color:rgba(255,255,255,0.7);margin-top:4px;">Your stores. One checklist.</div>
                    </td></tr>
                    <tr><td style="padding:36px 40px 28px;">
                      <p style="margin:0 0 6px;font-size:20px;font-weight:700;color:#0f172a;">Welcome, %s!</p>
                      <p style="margin:0 0 28px;font-size:14px;color:#64748b;line-height:1.7;">Your NForce RetailOps account is ready. Click the button below to set your password and get started.</p>
                      <p style="margin:0 0 16px;font-size:13px;color:#64748b;line-height:1.7;">This setup link is valid for <strong>72 hours</strong>.</p>
                      <div style="text-align:center;margin:0 0 28px;">
                        <a href="%s" style="display:inline-block;background:#10A3A8;color:#ffffff;font-size:14px;font-weight:700;padding:13px 36px;border-radius:8px;text-decoration:none;">Set Up My Account</a>
                      </div>
                      <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.7;">If you weren't expecting this email, you can safely ignore it.<br>This is an automated message from NForce RetailOps — please do not reply.</p>
                    </td></tr>
                    <tr><td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:16px 40px;text-align:center;">
                      <p style="margin:0;font-size:11px;color:#94a3b8;">&copy; 2026 NForce RetailOps &middot; All rights reserved</p>
                    </td></tr>
                  </table>
                </td></tr>
              </table>
            </body>
            </html>
            """.formatted(escapeHtml(fullName), setupLink);

        send(toEmail, "Set up your NForce RetailOps account", html);
    }

    public void sendPasswordResetEmail(String toEmail, String fullName, String resetLink) {
        String html = """
            <!DOCTYPE html>
            <html lang="en">
            <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
            <body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
              <table width="100%%" cellpadding="0" cellspacing="0" role="presentation" style="background:#f1f5f9;padding:40px 16px;">
                <tr><td align="center">
                  <table width="560" cellpadding="0" cellspacing="0" role="presentation" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
                    <tr><td style="background:#10A3A8;padding:28px 40px;text-align:center;">
                      <div style="font-size:20px;font-weight:800;color:#ffffff;letter-spacing:-0.3px;">NForce RetailOps</div>
                      <div style="font-size:12px;color:rgba(255,255,255,0.7);margin-top:4px;">Your stores. One checklist.</div>
                    </td></tr>
                    <tr><td style="padding:36px 40px 28px;">
                      <p style="margin:0 0 6px;font-size:20px;font-weight:700;color:#0f172a;">Password Reset</p>
                      <p style="margin:0 0 28px;font-size:14px;color:#64748b;line-height:1.7;">Hi %s, we received a request to reset your NForce RetailOps password. Click below to set a new one.</p>
                      <div style="text-align:center;margin:0 0 28px;">
                        <a href="%s" style="display:inline-block;background:#10A3A8;color:#ffffff;font-size:14px;font-weight:700;padding:13px 36px;border-radius:8px;text-decoration:none;">Reset My Password</a>
                      </div>
                      <p style="margin:0 0 28px;font-size:13px;color:#64748b;line-height:1.7;">This link expires in <strong>1 hour</strong>. If you did not request a reset, you can safely ignore this email.</p>
                      <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.7;">This is an automated message from NForce RetailOps — please do not reply.</p>
                    </td></tr>
                    <tr><td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:16px 40px;text-align:center;">
                      <p style="margin:0;font-size:11px;color:#94a3b8;">&copy; 2026 NForce RetailOps &middot; All rights reserved</p>
                    </td></tr>
                  </table>
                </td></tr>
              </table>
            </body>
            </html>
            """.formatted(escapeHtml(fullName), resetLink);

        send(toEmail, "Reset your NForce RetailOps password", html);
    }

    private static String escapeHtml(String value) {
        return value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
    }
}
