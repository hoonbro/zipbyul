package com.jipbyul.api;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class JipbyulApiApplication {

    public static void main(String[] args) {
        SpringApplication.run(JipbyulApiApplication.class, args);
    }
}
