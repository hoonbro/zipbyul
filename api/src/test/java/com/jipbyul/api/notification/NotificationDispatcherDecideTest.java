package com.jipbyul.api.notification;

import static com.jipbyul.api.notification.NotificationDispatcher.Outcome.DIGEST;
import static com.jipbyul.api.notification.NotificationDispatcher.Outcome.IGNORE;
import static com.jipbyul.api.notification.NotificationDispatcher.Outcome.IMMEDIATE;
import static org.assertj.core.api.Assertions.assertThat;

import com.jipbyul.api.notification.NotificationDispatcher.Outcome;
import org.junit.jupiter.api.Test;

/** 알림 강도 × 점수 × 이벤트유형별 즉시/요약/무시 판정 (기획안 6장·7장). */
class NotificationDispatcherDecideTest {

    private static Outcome decide(String eventType, String alertLevel, boolean txOptin,
                                  boolean regionMatch, int finalScore) {
        return NotificationDispatcher.decide(eventType, alertLevel, txOptin, regionMatch, finalScore);
    }

    @Test
    void allLevelAlwaysImmediate() {
        assertThat(decide("ANNOUNCEMENT_NEW", "ALL", false, false, 0)).isEqualTo(IMMEDIATE);
        assertThat(decide("RATE_DECISION", "ALL", false, true, 8)).isEqualTo(IMMEDIATE);
    }

    @Test
    void importantOnlyGatesOnScoreFour() {
        assertThat(decide("ANNOUNCEMENT_NEW", "IMPORTANT_ONLY", false, false, 4)).isEqualTo(IMMEDIATE);
        assertThat(decide("ANNOUNCEMENT_NEW", "IMPORTANT_ONLY", false, false, 3)).isEqualTo(DIGEST);
    }

    @Test
    void deadlineOnlyImmediateOnlyForDeadlineEvent() {
        assertThat(decide("APPLICATION_DEADLINE", "DEADLINE_ONLY", false, false, 1)).isEqualTo(IMMEDIATE);
        assertThat(decide("APPLICATION_START", "DEADLINE_ONLY", false, true, 9)).isEqualTo(DIGEST);
    }

    @Test
    void regionOnlyIgnoresNonMatchingRegion() {
        assertThat(decide("ANNOUNCEMENT_NEW", "REGION_ONLY", false, false, 9)).isEqualTo(IGNORE);
        assertThat(decide("ANNOUNCEMENT_NEW", "REGION_ONLY", false, true, 4)).isEqualTo(IMMEDIATE);
        assertThat(decide("ANNOUNCEMENT_NEW", "REGION_ONLY", false, true, 3)).isEqualTo(DIGEST);
    }

    @Test
    void dailyDigestOnlyAlwaysDigest() {
        assertThat(decide("APPLICATION_DEADLINE", "DAILY_DIGEST_ONLY", false, true, 10)).isEqualTo(DIGEST);
    }

    @Test
    void transactionImmediateNeedsOptinAndScoreFour() {
        assertThat(decide("TRANSACTION_NEW", "ALL", true, true, 4)).isEqualTo(IMMEDIATE);
        assertThat(decide("TRANSACTION_NEW", "ALL", false, true, 9)).isEqualTo(DIGEST);
        assertThat(decide("TRANSACTION_NEW", "ALL", true, true, 3)).isEqualTo(DIGEST);
    }

    @Test
    void unknownAlertLevelFallsBackToDigest() {
        assertThat(decide("ANNOUNCEMENT_NEW", "SOMETHING_NEW", false, true, 9)).isEqualTo(DIGEST);
    }
}
