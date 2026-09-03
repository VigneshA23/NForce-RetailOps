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

    public MailService(
        @Value("${resend.api-key}") String apiKey,
        @Value("${resend.from-email}") String fromEmail
    ) {
        this.fromEmail = fromEmail;
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
        String html = """
            <p>Hi %s,</p>
            <p>An account has been created for you on RetailOps. Use the temporary password below to sign in:</p>
            <p style="font-size:20px;font-weight:bold;letter-spacing:2px;">%s</p>
            <p>You will be asked to set a new password the first time you sign in.</p>
            """.formatted(escapeHtml(fullName), escapeHtml(temporaryPassword));

        send(toEmail, "Your RetailOps account is ready", html);
    }

    public void sendPasswordReset(String toEmail, String fullName, String temporaryPassword) {
        String html = """
            <p>Hi %s,</p>
            <p>Your RetailOps password was reset by your admin. Use the temporary password below to sign in:</p>
            <p style="font-size:20px;font-weight:bold;letter-spacing:2px;">%s</p>
            <p>You will be asked to set a new password the next time you sign in.</p>
            """.formatted(escapeHtml(fullName), escapeHtml(temporaryPassword));

        send(toEmail, "Your RetailOps password has been reset", html);
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

    private static String escapeHtml(String value) {
        return value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
    }
}
