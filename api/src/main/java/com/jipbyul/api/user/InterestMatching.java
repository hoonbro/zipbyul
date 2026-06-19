package com.jipbyul.api.user;

import java.util.Collection;
import java.util.Map;

/** 공고 supply_type → 관심유형(interest_type) 매핑 (contracts/enums.yaml 부록 A). */
public final class InterestMatching {

    private static final Map<String, InterestType> SUPPLY_TO_INTEREST = Map.of(
            "PRIVATE_SALE", InterestType.PRIVATE_SALE_SUB,
            "OFFICETEL", InterestType.PRIVATE_SALE_SUB,
            "PUBLIC_SALE", InterestType.PRIVATE_SALE_SUB,   // 공공분양 → 가장 근접한 민간청약 그룹
            "UNRANKED", InterestType.UNRANKED_SUB,
            "HAPPY_HOUSE", InterestType.HAPPY_HOUSE,
            "NATIONAL_RENTAL", InterestType.HAPPY_HOUSE,
            "PURCHASE_RENTAL", InterestType.PURCHASE_RENTAL,
            "JEONSE_RENTAL", InterestType.PURCHASE_RENTAL);

    private InterestMatching() {}

    public static InterestType forSupplyType(String supplyType) {
        return supplyType == null ? null : SUPPLY_TO_INTEREST.get(supplyType);
    }

    public static boolean matches(Collection<String> userInterestTypes, String supplyType) {
        InterestType mapped = forSupplyType(supplyType);
        return mapped != null && userInterestTypes.contains(mapped.name());
    }
}
