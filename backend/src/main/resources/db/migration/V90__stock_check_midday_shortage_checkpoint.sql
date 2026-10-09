-- Mid-day shortage reports (employee "Report Shortage"): the employee gives the
-- current usable stock, which becomes a usage checkpoint. Usage up to that
-- point is banked in mid_day_usage; checkpoint_usable / checkpoint_received are
-- the baseline the rest of the day's usage is measured from (stock used =
-- mid_day_usage + checkpoint usable + received since - EOD usable). All null/0
-- on a day with no report, which leaves SOD + received - EOD unchanged.
ALTER TABLE stock_checks
    ADD COLUMN mid_day_usage NUMERIC(12,2) NOT NULL DEFAULT 0,
    ADD COLUMN checkpoint_usable NUMERIC(12,2),
    ADD COLUMN checkpoint_received NUMERIC(12,2);
