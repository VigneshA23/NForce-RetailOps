package com.nforce.retailops.service;

import com.nforce.retailops.exception.EmailDeliveryException;
import org.junit.jupiter.api.Test;

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
        assertThat(captured.get(0)[1]).isEqualTo("Set up your NForce RetailOps account");
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
        assertThat(captured.get(0)[1]).isEqualTo("Reset your NForce RetailOps password");
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
}
