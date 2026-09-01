package com.nforce.retailops.service;

import com.nforce.retailops.exception.EmailDeliveryException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.util.List;
import java.util.Map;

@Service
public class MailService {

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
            throw new EmailDeliveryException("Failed to send the account email to " + toEmail);
        }
    }

    private static String escapeHtml(String value) {
        return value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
    }
}
