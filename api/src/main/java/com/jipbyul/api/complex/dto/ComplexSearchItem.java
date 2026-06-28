package com.jipbyul.api.complex.dto;

import java.time.LocalDate;

public record ComplexSearchItem(
        String complexNorm,
        String displayName,
        String guName,
        long transactionCount,
        LocalDate lastContractDate) {}
