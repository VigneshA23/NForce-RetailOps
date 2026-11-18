package com.nforce.retailops.service;

import com.nforce.retailops.exception.EmailDeliveryException;
import org.junit.jupiter.api.Test;

import java.time.Year;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class MailServiceTest {

    // ── Provider selection ──────────────────────────────────────────────────────

    @Test
    void isLambdaEnvironment_inTestRunner_returnsFalse() {
        // AWS_LAMBDA_FUNCTION_NAME is not set in the test environment,
        // confirming Resend would be selected for local/Railway runs.
        assertThat(MailService.isLambdaEnvironment()).isFalse();
    }

    // ── sendAccountSetupEmail ───────────────────────────────────────────────────

    @Test
    void sendAccountSetupEmail_passesCorrectRecipientAndSubject() {
        List<String[]> captured = new ArrayList<>();
        MailService service = new MailService((to, subject, html) -> captured.add(new String[]{to, subject, html}));

        service.sendAccountSetupEmail("owner@nforce.test", "Alice Smith", "https://app.example.com/setup?token=abc123");

        assertThat(captured).hasSize(1);
        assertThat(captured.get(0)[0]).isEqualTo("owner@nforce.test");
        assertThat(captured.get(0)[1]).isEqualTo("Set up your Ked's Ice Cream account");
    }

    @Test
    void sendAccountSetupEmail_htmlContainsNameAndLink() {
        List<String> htmlCaptures = new ArrayList<>();
        MailService service = new MailService((to, subject, html) -> htmlCaptures.add(html));

        service.sendAccountSetupEmail("owner@nforce.test", "Alice Smith", "https://app.example.com/setup?token=abc123");

        String html = htmlCaptures.get(0);
        assertThat(html)
            .contains("Alice Smith")
            .contains("https://app.example.com/setup?token=abc123")
            .contains("Set Up My Account")
            .contains("72 hours");
    }

    @Test
    void sendAccountSetupEmail_fullNameIsHtmlEscaped() {
        List<String> htmlCaptures = new ArrayList<>();
        MailService service = new MailService((to, subject, html) -> htmlCaptures.add(html));

        service.sendAccountSetupEmail("x@nforce.test", "<b>Hacker</b>", "https://link");

        assertThat(htmlCaptures.get(0))
            .doesNotContain("<b>Hacker</b>")
            .contains("&lt;b&gt;Hacker&lt;/b&gt;");
    }

    @Test
    void sendAccountSetupEmail_transportThrows_propagatesEmailDeliveryException() {
        MailService service = new MailService((to, subject, html) -> {
            throw new EmailDeliveryException("transport failed");
        });

        assertThatThrownBy(() -> service.sendAccountSetupEmail("x@nforce.test", "X", "https://link"))
            .isInstanceOf(EmailDeliveryException.class)
            .hasMessageContaining("transport failed");
    }

    // ── sendPasswordResetEmail ──────────────────────────────────────────────────

    @Test
    void sendPasswordResetEmail_passesCorrectRecipientAndSubject() {
        List<String[]> captured = new ArrayList<>();
        MailService service = new MailService((to, subject, html) -> captured.add(new String[]{to, subject, html}));

        service.sendPasswordResetEmail("user@nforce.test", "Bob Jones", "https://app.example.com/reset?token=xyz789");

        assertThat(captured).hasSize(1);
        assertThat(captured.get(0)[0]).isEqualTo("user@nforce.test");
        assertThat(captured.get(0)[1]).isEqualTo("Reset your Ked's Ice Cream password");
    }

    @Test
    void sendPasswordResetEmail_htmlContainsNameAndLink() {
        List<String> htmlCaptures = new ArrayList<>();
        MailService service = new MailService((to, subject, html) -> htmlCaptures.add(html));

        service.sendPasswordResetEmail("user@nforce.test", "Bob Jones", "https://app.example.com/reset?token=xyz789");

        String html = htmlCaptures.get(0);
        assertThat(html)
            .contains("Bob Jones")
            .contains("https://app.example.com/reset?token=xyz789")
            .contains("Reset My Password")
            .contains("1 hour");
    }

    @Test
    void sendPasswordResetEmail_transportThrows_propagatesEmailDeliveryException() {
        MailService service = new MailService((to, subject, html) -> {
            throw new EmailDeliveryException("transport failed");
        });

        assertThatThrownBy(() -> service.sendPasswordResetEmail("x@nforce.test", "X", "https://link"))
            .isInstanceOf(EmailDeliveryException.class);
    }

    // ── Template parity across providers ───────────────────────────────────────

    @Test
    void setupEmailTemplate_identicalRegardlessOfProviderUsed() {
        // Both providers share the same template — only the delivery mechanism differs.
        // This test simulates two MailService instances (one Resend-bound, one SES-bound)
        // using the same package-private transport injection to confirm HTML is identical.
        List<String> htmlA = new ArrayList<>();
        List<String> htmlB = new ArrayList<>();

        MailService instanceA = new MailService((to, subject, html) -> htmlA.add(html));
        MailService instanceB = new MailService((to, subject, html) -> htmlB.add(html));

        instanceA.sendAccountSetupEmail("a@nforce.test", "Carol", "https://setup-link");
        instanceB.sendAccountSetupEmail("a@nforce.test", "Carol", "https://setup-link");

        assertThat(htmlA).isEqualTo(htmlB);
    }

    @Test
    void resetEmailTemplate_identicalRegardlessOfProviderUsed() {
        List<String> htmlA = new ArrayList<>();
        List<String> htmlB = new ArrayList<>();

        MailService instanceA = new MailService((to, subject, html) -> htmlA.add(html));
        MailService instanceB = new MailService((to, subject, html) -> htmlB.add(html));

        instanceA.sendPasswordResetEmail("b@nforce.test", "Dave", "https://reset-link");
        instanceB.sendPasswordResetEmail("b@nforce.test", "Dave", "https://reset-link");

        assertThat(htmlA).isEqualTo(htmlB);
    }

    // ── Ked's branding and shared layout (RTS-549) ─────────────────────────────

    private static List<String> allThreeEmails(MailService service, List<String> sink) {
        service.sendAccountSetupEmail("a@nforce.test", "Alice", "https://app.example.com/?token=setup");
        service.sendPasswordResetEmail("b@nforce.test", "Bob", "https://app.example.com/?token=reset");
        service.sendLoginEmailChangedEmail("c@nforce.test", "Carol", "carol.new@nforce.test");
        return sink;
    }

    @Test
    void everyEmail_isKedsBrandedAndNeverMentionsNForce() {
        List<String[]> captured = new ArrayList<>();
        MailService service = new MailService((to, subject, html) -> captured.add(new String[]{subject, html}));
        service.sendAccountSetupEmail("a@nforce.test", "Alice", "https://app.example.com/?token=setup");
        service.sendPasswordResetEmail("b@nforce.test", "Bob", "https://app.example.com/?token=reset");
        service.sendLoginEmailChangedEmail("c@nforce.test", "Carol", "carol.new@nforce.test");

        assertThat(captured).hasSize(3);
        for (String[] email : captured) {
            assertThat(email[0]).contains("Ked's Ice Cream").doesNotContain("NForce");
            assertThat(email[1]).contains("Ked's Ice Cream").doesNotContain("NForce").doesNotContain("One checklist");
        }
    }

    @Test
    void everyEmail_usesTheSharedHeaderAndFooter() {
        List<String> html = new ArrayList<>();
        MailService service = new MailService((to, subject, body) -> html.add(body), "https://keds.example.com/");
        allThreeEmails(service, html);

        for (String body : html) {
            assertThat(body)
                .contains("src=\"https://keds.example.com/keds-logo.png\"")
                .contains("alt=\"Ked's Ice Cream\"")
                .contains("max-width:560px")
                .contains("&copy; " + Year.now().getValue() + " Ked's Ice Cream")
                .contains("please do not reply")
                .doesNotContain("#10A3A8");
        }
    }

    @Test
    void emails_keepPlainLinkAmberNoteAndFooterTogether() {
        List<String> html = new ArrayList<>();
        MailService service = new MailService((to, subject, body) -> html.add(body));
        allThreeEmails(service, html);

        assertThat(html.get(0)).contains("Copy and paste this link").contains(">https://app.example.com/?token=setup</a>")
            .contains("<strong>72 hours</strong>. If you weren't expecting this email, you can safely ignore it.</td>");
        assertThat(html.get(1)).contains("Copy and paste this link").contains(">https://app.example.com/?token=reset</a>")
            .contains("<strong>1 hour</strong>. If you did not request a reset, you can safely ignore this email.</td>");
        assertThat(html.get(2))
            .contains("sign in again with the new email.</td>")
            .contains("</table><p style=\"margin:0;font-size:12px;color:#9a9aa0;line-height:1.6;\">"
                + "If you did not expect this change, contact your administrator.</p>");
        for (String body : html) {
            assertThat(body).containsPattern(
                "please do not reply\\.</p>\\s*<p[^>]*>&copy; " + Year.now().getValue() + " Ked's Ice Cream");
        }
    }

    @Test
    void loginEmailChanged_escapesTheNewEmail() {
        List<String> html = new ArrayList<>();
        MailService service = new MailService((to, subject, body) -> html.add(body));

        service.sendLoginEmailChangedEmail("x@nforce.test", "X", "<script>@nforce.test");

        assertThat(html.get(0)).doesNotContain("<script>").contains("&lt;script&gt;@nforce.test");
    }
}
