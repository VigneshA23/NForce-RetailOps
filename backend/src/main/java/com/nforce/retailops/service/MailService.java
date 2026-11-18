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

import java.time.Year;
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
    // Absolute URL of the Ked's logo in the email header (the frontend's /keds-logo.png).
    private final String logoUrl;

    @Autowired
    public MailService(
        @Value("${resend.api-key:}") String resendApiKey,
        @Value("${resend.from-email}") String resendFromEmail,
        @Value("${ses.from-email:noreply@nforceone.com}") String sesFromEmail,
        @Value("${app.base-url}") String appBaseUrl
    ) {
        this.logoUrl = logoUrlFor(appBaseUrl);
        boolean isLambda = isLambdaEnvironment();
        log.info("MailService: provider={}", isLambda ? "SES (us-east-1)" : "Resend");
        this.transport = isLambda
            ? buildSesTransport(sesFromEmail)
            : buildResendTransport(resendApiKey, resendFromEmail);
    }

    // Package-private: lets tests inject a capture transport without touching real providers.
    MailService(EmailTransport transport) {
        this(transport, "https://app.example.com");
    }

    MailService(EmailTransport transport, String appBaseUrl) {
        this.transport = transport;
        this.logoUrl = logoUrlFor(appBaseUrl);
    }

    private static String logoUrlFor(String appBaseUrl) {
        String base = appBaseUrl.endsWith("/") ? appBaseUrl.substring(0, appBaseUrl.length() - 1) : appBaseUrl;
        return base + "/keds-logo.png";
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
                String detail;
                if (ex instanceof RestClientResponseException r) {
                    detail = r.getResponseBodyAsString();
                    log.error("Resend send failed for {} from '{}': HTTP {} - response body: {}",
                        to, fromEmail, r.getStatusCode().value(), detail, ex);
                } else {
                    detail = ex.getMessage();
                    log.error("Resend send failed for {} from '{}' (no HTTP response, e.g. timeout/network): {}",
                        to, fromEmail, detail, ex);
                }
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
        String content = greeting("Welcome, " + escapeHtml(fullName) + "!")
            + paragraph("Your " + BRAND_NAME + " account is ready. Click the button below to set your password and get started.")
            + button("Set Up My Account", setupLink)
            + plainLink(setupLink)
            + note("This setup link is valid for <strong>72 hours</strong>. If you weren't expecting this email, you can safely ignore it.");

        send(toEmail, "Set up your " + BRAND_NAME + " account", layout(content));
    }

    public void sendPasswordResetEmail(String toEmail, String fullName, String resetLink) {
        String content = greeting("Password Reset")
            + paragraph("Hi " + escapeHtml(fullName) + ", we received a request to reset your " + BRAND_NAME
                + " password. Click below to set a new one.")
            + button("Reset My Password", resetLink)
            + plainLink(resetLink)
            + note("This link expires in <strong>1 hour</strong>. If you did not request a reset, you can safely ignore this email.");

        send(toEmail, "Reset your " + BRAND_NAME + " password", layout(content));
    }

    // Sent to both the old and the new address when an admin changes the login
    // email of an account that is already set up, so the owner of the old
    // address learns of the change rather than just finding their login gone.
    public void sendLoginEmailChangedEmail(String toEmail, String fullName, String newEmail) {
        String content = greeting("Your login email was changed")
            + paragraph("Hi " + escapeHtml(fullName) + ", an administrator changed the email you use to sign in to "
                + BRAND_NAME + ".")
            + paragraph("New login email: <strong style=\"color:" + TEXT + ";\">" + escapeHtml(newEmail) + "</strong>")
            + note("Your password is unchanged. You have been signed out and can sign in again with the new email.")
            + smallPrint("If you did not expect this change, contact your administrator.");

        send(toEmail, "Your " + BRAND_NAME + " login email was changed", layout(content));
    }

    // ── Shared Ked's layout ─────────────────────────────────────────────────────
    // Every email is built from these pieces, so the brand (name, logo, colours,
    // footer) is defined once. Inline styles and tables only: that is what
    // Gmail, Outlook and Apple Mail all render. Colours are the app's palette
    // (StatCard.css): pink primary, sky blue, warm yellow.

    static final String BRAND_NAME = "Ked's Ice Cream";
    private static final String PINK = "#d0178e";
    private static final String BLUE = "#3fa8f4";
    private static final String YELLOW = "#e5a52e";
    private static final String TEXT = "#1a1a1a";
    private static final String MUTED = "#6b6b6f";
    private static final String FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

    // The header logo is the login page's /keds-logo.png, served by the frontend
    // at app.base-url. Clients that block images show the alt text instead,
    // styled as a pink "Ked's Ice Cream" wordmark.
    String layout(String content) {
        return """
            <!DOCTYPE html>
            <html lang="en">
            <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width,initial-scale=1.0">
            <meta name="color-scheme" content="light">
            <meta name="supported-color-schemes" content="light">
            <title>%1$s</title>
            </head>
            <body style="margin:0;padding:0;background:#f2f2f4;font-family:%2$s;">
              <table width="100%%" cellpadding="0" cellspacing="0" role="presentation" bgcolor="#f2f2f4" style="background:#f2f2f4;padding:32px 12px;">
                <tr><td align="center">
                  <table width="100%%" cellpadding="0" cellspacing="0" role="presentation" bgcolor="#ffffff" style="width:100%%;max-width:560px;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
                    <tr><td style="padding:0;font-size:0;line-height:0;">
                      <table width="100%%" cellpadding="0" cellspacing="0" role="presentation"><tr>
                        <td height="6" bgcolor="%3$s" style="background:%3$s;height:6px;width:34%%;"></td>
                        <td height="6" bgcolor="%4$s" style="background:%4$s;height:6px;width:33%%;"></td>
                        <td height="6" bgcolor="%5$s" style="background:%5$s;height:6px;width:33%%;"></td>
                      </tr></table>
                    </td></tr>
                    <tr><td align="center" bgcolor="#ffffff" style="background:#ffffff;padding:28px 32px 8px;">
                      <img src="%6$s" width="240" alt="%1$s" style="display:block;margin:0 auto;width:240px;max-width:80%%;height:auto;border:0;font-family:%2$s;font-size:22px;line-height:1.3;white-space:nowrap;font-weight:800;color:%4$s;text-align:center;">
                    </td></tr>
                    <tr><td style="padding:24px 32px 28px;">
                      %7$s
                    </td></tr>
                    <tr><td bgcolor="#fafafa" style="background:#fafafa;border-top:1px solid #e4e4e7;padding:18px 32px;text-align:center;">
                      <p style="margin:0 0 4px;font-size:12px;color:#6b6b6f;line-height:1.6;">This is an automated message from %1$s. Please do not reply.</p>
                      <p style="margin:0;font-size:11px;color:#9a9aa0;">&copy; %8$d %1$s &middot; All rights reserved</p>
                    </td></tr>
                  </table>
                </td></tr>
              </table>
            </body>
            </html>
            """.formatted(BRAND_NAME, FONT, BLUE, PINK, YELLOW, escapeHtml(logoUrl), content, Year.now().getValue());
    }

    private static String greeting(String text) {
        return "<p style=\"margin:0 0 8px;font-size:20px;font-weight:700;color:" + TEXT + ";\">" + text + "</p>";
    }

    private static String paragraph(String html) {
        return "<p style=\"margin:0 0 20px;font-size:14px;color:" + MUTED + ";line-height:1.7;\">" + html + "</p>";
    }

    private static String button(String label, String href) {
        String safeHref = escapeHtml(href);
        return "<table cellpadding=\"0\" cellspacing=\"0\" role=\"presentation\" align=\"center\" style=\"margin:4px auto 24px;\"><tr>"
            + "<td align=\"center\" bgcolor=\"" + PINK + "\" style=\"background:" + PINK + ";border-radius:999px;\">"
            + "<a href=\"" + safeHref + "\" style=\"display:inline-block;padding:13px 36px;font-family:" + FONT
            + ";font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:999px;\">" + label + "</a>"
            + "</td></tr></table>";
    }

    // Expiry and similar: a yellow-tinted callout so it stands apart from the body.
    private static String note(String html) {
        return "<table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" role=\"presentation\" style=\"margin:0 0 20px;\"><tr>"
            + "<td bgcolor=\"#fdf6e7\" style=\"background:#fdf6e7;border-left:4px solid " + YELLOW
            + ";border-radius:8px;padding:12px 16px;font-size:13px;color:#5c4512;line-height:1.6;\">" + html + "</td>"
            + "</tr></table>";
    }

    // The link as text under the button, for clients that don't render it (RTS-549).
    private static String plainLink(String href) {
        String safeHref = escapeHtml(href);
        return "<p style=\"margin:0 0 4px;font-size:12px;color:" + MUTED + ";line-height:1.6;\">"
            + "Button not working? Copy and paste this link into your browser:</p>"
            + "<p style=\"margin:0 0 20px;font-size:12px;line-height:1.6;word-break:break-all;\">"
            + "<a href=\"" + safeHref + "\" style=\"color:" + BLUE + ";text-decoration:underline;\">" + safeHref + "</a></p>";
    }

    private static String smallPrint(String text) {
        return "<p style=\"margin:0;font-size:12px;color:#9a9aa0;line-height:1.6;\">" + text + "</p>";
    }

    private static String escapeHtml(String value) {
        return value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;");
    }
}
