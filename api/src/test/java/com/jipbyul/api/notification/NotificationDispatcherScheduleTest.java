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

    @Test
    void detectsSameDayDndWindow() {
        LocalTime start = LocalTime.of(13, 0);
        LocalTime end = LocalTime.of(14, 0);

        assertThat(NotificationDispatcher.inDnd(LocalTime.of(13, 30), start, end)).isTrue();
        assertThat(NotificationDispatcher.inDnd(LocalTime.of(14, 0), start, end)).isFalse(); // 끝 시각 제외
        assertThat(NotificationDispatcher.inDnd(LocalTime.of(12, 0), start, end)).isFalse();
    }

    @Test
    void noDndWhenUnsetOrZeroWidth() {
        assertThat(NotificationDispatcher.inDnd(LocalTime.of(3, 0), null, LocalTime.of(7, 0))).isFalse();
        assertThat(NotificationDispatcher.inDnd(LocalTime.of(3, 0), LocalTime.of(7, 0), LocalTime.of(7, 0))).isFalse();
    }

    @Test
    void defersUntilSameDayDndEnds() {
        OffsetDateTime now = OffsetDateTime.of(2026, 6, 19, 13, 30, 0, 0, KST);

        assertThat(NotificationDispatcher.nextAllowedAt(now, LocalTime.of(13, 0), LocalTime.of(14, 0)))
                .isEqualTo(OffsetDateTime.of(2026, 6, 19, 14, 0, 0, 0, KST));
    }

    @Test
    void allowsImmediatelyWhenOutsideDnd() {
        OffsetDateTime now = OffsetDateTime.of(2026, 6, 19, 12, 0, 0, 0, KST);

        assertThat(NotificationDispatcher.nextAllowedAt(now, LocalTime.of(22, 0), LocalTime.of(7, 0)))
                .isEqualTo(now);
    }

    @Test
    void schedulesDigestLaterTodayWhenTimeNotYetPassed() {
        OffsetDateTime now = OffsetDateTime.of(2026, 6, 19, 9, 0, 0, 0, KST);

        assertThat(NotificationDispatcher.nextDigestAt(now, LocalTime.of(18, 0), null, null))
                .isEqualTo(OffsetDateTime.of(2026, 6, 19, 18, 0, 0, 0, KST));
    }

    @Test
    void defaultsDigestToEightAmWhenUnset() {
        OffsetDateTime now = OffsetDateTime.of(2026, 6, 19, 9, 0, 0, 0, KST);

        assertThat(NotificationDispatcher.nextDigestAt(now, null, null, null))
                .isEqualTo(OffsetDateTime.of(2026, 6, 20, 8, 0, 0, 0, KST));
    }
}
