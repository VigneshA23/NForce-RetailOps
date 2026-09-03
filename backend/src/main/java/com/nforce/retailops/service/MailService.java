package com.nforce.retailops.service;

import com.nforce.retailops.exception.EmailDeliveryException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
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

    public MailService(
        @Value("${resend.api-key}") String apiKey,
        @Value("${resend.from-email}") String fromEmail
    ) {
        this.fromEmail = fromEmail;
        this.restClient = RestClient.builder()
            .baseUrl("https://api.resend.com")
            .defaultHeader("Authorization", "Bearer " + apiKey)
            .build();
    }

    public void sendTemporaryPassword(String toEmail, String fullName, String temporaryPassword) {
        String html = """
            <p>Hi %s,</p>
            <p>An account has been created for you on RetailOps. Use the temporary password below to sign in:</p>
            <p style="font-size:20px;font-weight:bold;letter-spacing:2px;">%s</p>
            <p>You will be asked to set a new password the first time you sign in.</p>
            """.formatted(escapeHtml(fullName), escapeHtml(temporaryPassword));

        try {
            restClient.post()
                .uri("/emails")
                .body(Map.of(
                    "from", fromEmail,
                    "to", List.of(toEmail),
                    "subject", "Your RetailOps account is ready",
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
            <p>Hi %s,</p>
            <p>We received a request to reset your RetailOps password. Click the button below to set a new one:</p>
            <p style="margin:24px 0;">
              <a href="%s" style="background:#e11d33;color:#ffffff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:700;font-size:15px;">Reset Password</a>
            </p>
            <p>This link expires in <strong>1 hour</strong>. If you did not request a reset, you can safely ignore this email.</p>
            """.formatted(escapeHtml(fullName), resetLink);

        try {
            restClient.post()
                .uri("/emails")
                .body(Map.of(
                    "from", fromEmail,
                    "to", List.of(toEmail),
                    "subject", "Reset your RetailOps password",
                    "html", html
                ))
                .retrieve()
                .toBodilessEntity();
        } catch (RestClientException ex) {
            log.error("Resend password reset send failed for {}", toEmail, ex);
            throw new EmailDeliveryException("Failed to send the reset email to " + toEmail);
        }
    }

    private static String escapeHtml(String value) {
        return value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
    }
}
