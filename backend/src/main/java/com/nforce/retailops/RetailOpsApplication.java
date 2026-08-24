package com.nforce.retailops;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class RetailOpsApplication {

    public static void main(String[] args) {
        SpringApplication.run(RetailOpsApplication.class, args);
    }
}
