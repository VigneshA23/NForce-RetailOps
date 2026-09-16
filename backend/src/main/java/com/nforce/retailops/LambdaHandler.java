package com.nforce.retailops;

import com.amazonaws.serverless.exceptions.ContainerInitializationException;
import com.amazonaws.serverless.proxy.model.HttpApiV2ProxyRequest;
import com.amazonaws.serverless.proxy.model.AwsProxyResponse;
import com.amazonaws.serverless.proxy.spring.SpringBootLambdaContainerHandler;
import com.amazonaws.serverless.proxy.spring.SpringBootProxyHandlerBuilder;
import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.RequestStreamHandler;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;

/**
 * Lambda entry point. Wraps the existing Spring Boot application behind a
 * RequestStreamHandler — all existing controllers, services, and security
 * filters run unchanged inside the initialized Spring context.
 *
 * Async init: the Spring context initializes in the Lambda init phase
 * (background thread), not blocking the first request. This reduces
 * perceived cold-start latency from the caller's perspective.
 *
 * This class has zero effect on Railway or local dev — it is only invoked
 * when the JAR is deployed to AWS Lambda.
 */
public class LambdaHandler implements RequestStreamHandler {

    private static final SpringBootLambdaContainerHandler<HttpApiV2ProxyRequest, AwsProxyResponse> handler;

    static {
        try {
            handler = new SpringBootProxyHandlerBuilder<HttpApiV2ProxyRequest>()
                .defaultHttpApiV2Proxy()
                .asyncInit()
                .springBootApplication(RetailOpsApplication.class)
                .buildAndInitialize();
        } catch (ContainerInitializationException e) {
            throw new RuntimeException("Failed to initialize Spring Boot Lambda container", e);
        }
    }

    @Override
    public void handleRequest(InputStream inputStream, OutputStream outputStream, Context context)
            throws IOException {
        handler.proxyStream(inputStream, outputStream, context);
    }
}
