package com.jipbyul.api.notification;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import org.junit.jupiter.api.Test;

class NotificationDispatcherScheduleTest {

    private static final ZoneOffset KST = ZoneOffset.ofHours(9);

    @Test
    void detectsOvernightDnd() {
        LocalTime start = LocalTime.of(22, 0);
        LocalTime end = LocalTime.of(7, 0);

        assertThat(NotificationDispatcher.inDnd(LocalTime.of(23, 0), start, end)).isTrue();
        assertThat(NotificationDispatcher.inDnd(LocalTime.of(6, 59), start, end)).isTrue();
        assertThat(NotificationDispatcher.inDnd(LocalTime.of(12, 0), start, end)).isFalse();
    }

    @Test
    void defersUntilOvernightDndEnds() {
        OffsetDateTime now = OffsetDateTime.of(2026, 6, 19, 23, 30, 0, 0, KST);

        assertThat(NotificationDispatcher.nextAllowedAt(
                now, LocalTime.of(22, 0), LocalTime.of(7, 0)))
                .isEqualTo(OffsetDateTime.of(2026, 6, 20, 7, 0, 0, 0, KST));
    }

    @Test
    void schedulesDigestForNextConfiguredTimeAndRespectsDnd() {
        OffsetDateTime now = OffsetDateTime.of(2026, 6, 19, 9, 0, 0, 0, KST);

        assertThat(NotificationDispatcher.nextDigestAt(
                now, LocalTime.of(6, 0), LocalTime.of(22, 0), LocalTime.of(7, 0)))
                .isEqualTo(OffsetDateTime.of(2026, 6, 20, 7, 0, 0, 0, KST));
    }
}
