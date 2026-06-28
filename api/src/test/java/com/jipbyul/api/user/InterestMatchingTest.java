package com.jipbyul.api.user;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Set;
import org.junit.jupiter.api.Test;

class InterestMatchingTest {

    @Test
    void mapsSupplyTypeToInterest() {
        assertThat(InterestMatching.forSupplyType("PRIVATE_SALE")).isEqualTo(InterestType.PRIVATE_SALE_SUB);
        assertThat(InterestMatching.forSupplyType("OFFICETEL")).isEqualTo(InterestType.PRIVATE_SALE_SUB);
        assertThat(InterestMatching.forSupplyType("PUBLIC_SALE")).isEqualTo(InterestType.PRIVATE_SALE_SUB);
        assertThat(InterestMatching.forSupplyType("UNRANKED")).isEqualTo(InterestType.UNRANKED_SUB);
        assertThat(InterestMatching.forSupplyType("NATIONAL_RENTAL")).isEqualTo(InterestType.HAPPY_HOUSE);
        assertThat(InterestMatching.forSupplyType("JEONSE_RENTAL")).isEqualTo(InterestType.PURCHASE_RENTAL);
        assertThat(InterestMatching.forSupplyType("YOUTH_SAFE_HOUSE")).isEqualTo(InterestType.YOUTH_SAFE_HOUSE);
        assertThat(InterestMatching.forSupplyType("LONG_TERM_JEONSE")).isEqualTo(InterestType.LONG_TERM_JEONSE);
        assertThat(InterestMatching.forSupplyType(null)).isNull();
        assertThat(InterestMatching.forSupplyType("UNKNOWN")).isNull();
    }

    @Test
    void matchesManualShSupplyTypes() {
        assertThat(InterestMatching.matches(Set.of("YOUTH_SAFE_HOUSE"), "YOUTH_SAFE_HOUSE")).isTrue();
        assertThat(InterestMatching.matches(Set.of("LONG_TERM_JEONSE"), "LONG_TERM_JEONSE")).isTrue();
        assertThat(InterestMatching.matches(Set.of("YOUTH_SAFE_HOUSE"), "LONG_TERM_JEONSE")).isFalse();
    }

    @Test
    void matchesWhenUserInterestCoversSupplyType() {
        assertThat(InterestMatching.matches(Set.of("HAPPY_HOUSE"), "NATIONAL_RENTAL")).isTrue();
        assertThat(InterestMatching.matches(Set.of("PRIVATE_SALE_SUB"), "OFFICETEL")).isTrue();
    }

    @Test
    void doesNotMatchUnrelatedOrUnknown() {
        assertThat(InterestMatching.matches(Set.of("PRIVATE_SALE_SUB"), "UNRANKED")).isFalse();
        assertThat(InterestMatching.matches(Set.of("HAPPY_HOUSE"), "UNKNOWN")).isFalse();
        assertThat(InterestMatching.matches(Set.of(), "PRIVATE_SALE")).isFalse();
    }
}
