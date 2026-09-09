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

import java.util.List;
import java.util.Map;

@Service
public class MailService {

    private static final Logger log = LoggerFactory.getLogger(MailService.class);

    private final RestClient restClient;
    private final String fromEmail;
    private final String appBaseUrl;

    public MailService(
        @Value("${resend.api-key}") String apiKey,
        @Value("${resend.from-email}") String fromEmail,
        @Value("${app.base-url}") String appBaseUrl
    ) {
        this.fromEmail = fromEmail;
        this.appBaseUrl = appBaseUrl;
        // Bounded so a slow/hung Resend response can only ever block the calling
        // request (and hold its DB transaction/connection open) for a fixed worst
        // case, instead of indefinitely.
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(3_000);
        requestFactory.setReadTimeout(5_000);
        this.restClient = RestClient.builder()
            .baseUrl("https://api.resend.com")
            .defaultHeader("Authorization", "Bearer " + apiKey)
            .requestFactory(requestFactory)
            .build();
    }

    public void sendTemporaryPassword(String toEmail, String fullName, String temporaryPassword) {
        String html = buildAccountCreatedEmail(escapeHtml(fullName), escapeHtml(temporaryPassword), appBaseUrl);
        send(toEmail, "Your NForce RetailOps account is ready", html);
    }

    public void sendPasswordReset(String toEmail, String fullName, String temporaryPassword) {
        String html = buildPasswordResetEmail(escapeHtml(fullName), escapeHtml(temporaryPassword), appBaseUrl);
        send(toEmail, "Your NForce RetailOps password has been reset", html);
    }

    private void send(String toEmail, String subject, String html) {
        try {
            restClient.post()
                .uri("/emails")
                .body(Map.of(
                    "from", fromEmail,
                    "to", List.of(toEmail),
                    "subject", subject,
                    "html", html
                ))
                .retrieve()
                .toBodilessEntity();
        } catch (RestClientException ex) {
            log.error("Resend send failed for {}", toEmail, ex);
            // Only a trusted super admin ever sees this message (it comes back through
            // a super-admin-only endpoint), so it's safe -- and far more useful than a
            // blank "failed" -- to surface Resend's own rejection reason here.
            String detail = ex instanceof RestClientResponseException responseEx
                ? responseEx.getResponseBodyAsString()
                : ex.getMessage();
            throw new EmailDeliveryException("Failed to send the account email to " + toEmail + ": " + detail);
        }
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

        try {
            restClient.post()
                .uri("/emails")
                .body(Map.of(
                    "from", fromEmail,
                    "to", List.of(toEmail),
                    "subject", "Reset your NForce RetailOps password",
                    "html", html
                ))
                .retrieve()
                .toBodilessEntity();
        } catch (RestClientException ex) {
            log.error("Resend password reset send failed for {}", toEmail, ex);
            throw new EmailDeliveryException("Failed to send the reset email to " + toEmail);
        }
    }

    private static String buildAccountCreatedEmail(String name, String password, String loginUrl) {
        return """
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
                      <p style="margin:0 0 6px;font-size:22px;font-weight:700;color:#0f172a;">Welcome, %s!</p>
                      <p style="margin:0 0 28px;font-size:14px;color:#64748b;line-height:1.7;">Your NForce RetailOps account is ready. Use the temporary password below to sign in &mdash; you&apos;ll be asked to create a new one on your first login.</p>
                      <div style="background:#f8fafc;border:1.5px dashed #cbd5e1;border-radius:10px;padding:24px;text-align:center;margin:0 0 28px;">
                        <div style="font-size:11px;font-weight:700;color:#94a3b8;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:10px;">Temporary Password</div>
                        <div style="font-size:28px;font-weight:800;color:#0f172a;letter-spacing:5px;font-family:'Courier New',Courier,monospace;">%s</div>
                      </div>
                      <div style="text-align:center;margin:0 0 28px;">
                        <a href="%s" style="display:inline-block;background:#10A3A8;color:#ffffff;font-size:14px;font-weight:700;padding:13px 36px;border-radius:8px;text-decoration:none;">Sign in to RetailOps</a>
                      </div>
                      <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.7;">Need help? Contact your manager or the RetailOps team.<br>This is an automated message &mdash; please do not reply.</p>
                    </td></tr>
                    <tr><td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:16px 40px;text-align:center;">
                      <p style="margin:0;font-size:11px;color:#94a3b8;">&copy; 2026 NForce RetailOps &middot; All rights reserved</p>
                    </td></tr>
                  </table>
                </td></tr>
              </table>
            </body>
            </html>
            """.formatted(name, password, loginUrl);
    }

    private static String buildPasswordResetEmail(String name, String password, String loginUrl) {
        return """
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
                      <p style="margin:0 0 6px;font-size:22px;font-weight:700;color:#0f172a;">Password Reset</p>
                      <p style="margin:0 0 28px;font-size:14px;color:#64748b;line-height:1.7;">Hi %s, your admin has reset your NForce RetailOps password. Use the temporary password below to sign in immediately &mdash; you&apos;ll be asked to set a new one right away.</p>
                      <div style="background:#f8fafc;border:1.5px dashed #cbd5e1;border-radius:10px;padding:24px;text-align:center;margin:0 0 28px;">
                        <div style="font-size:11px;font-weight:700;color:#94a3b8;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:10px;">Temporary Password</div>
                        <div style="font-size:28px;font-weight:800;color:#0f172a;letter-spacing:5px;font-family:'Courier New',Courier,monospace;">%s</div>
                      </div>
                      <div style="text-align:center;margin:0 0 28px;">
                        <a href="%s" style="display:inline-block;background:#10A3A8;color:#ffffff;font-size:14px;font-weight:700;padding:13px 36px;border-radius:8px;text-decoration:none;">Sign in to RetailOps</a>
                      </div>
                      <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.7;">Need help? Contact your manager or the RetailOps team.<br>This is an automated message &mdash; please do not reply.</p>
                    </td></tr>
                    <tr><td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:16px 40px;text-align:center;">
                      <p style="margin:0;font-size:11px;color:#94a3b8;">&copy; 2026 NForce RetailOps &middot; All rights reserved</p>
                    </td></tr>
                  </table>
                </td></tr>
              </table>
            </body>
            </html>
            """.formatted(name, password, loginUrl);
    }

    private static String escapeHtml(String value) {
        return value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
    }
}
