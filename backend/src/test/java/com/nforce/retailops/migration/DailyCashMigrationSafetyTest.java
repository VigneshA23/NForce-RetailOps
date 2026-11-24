package com.nforce.retailops.migration;

import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Locale;

import static org.assertj.core.api.Assertions.assertThat;

class DailyCashMigrationSafetyTest {

    private static final String V124 =
        "db/migration/V124__daily_cash_reset_and_drop_dead_columns.sql";

    @Test
    void v124PreservesDailyCashRowsAuditHistoryAndLegacyAmounts() throws IOException {
        String sql;
        try (InputStream stream = getClass().getClassLoader().getResourceAsStream(V124)) {
            assertThat(stream).as("V124 migration resource").isNotNull();
            sql = new String(stream.readAllBytes(), StandardCharsets.UTF_8);
        }

        String executableSql = sql.lines()
            .filter(line -> !line.stripLeading().startsWith("--"))
            .reduce("", (left, right) -> left + "\n" + right)
            .toUpperCase(Locale.ROOT);

        assertThat(executableSql)
            .doesNotContain("DELETE FROM")
            .doesNotContain("TRUNCATE ")
            .doesNotContain("DROP COLUMN");

        assertThat(sql)
            .contains("total_cash_sales")
            .contains("bank_deposits")
            .contains("cash_expenses");
    }
}
