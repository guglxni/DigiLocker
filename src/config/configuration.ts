import { LogLevel } from '@nestjs/common/services/logger.service';
import { ConfigObject } from '@nestjs/config';
import { Logger } from '@nestjs/common';

// Remove initialNodeEnvAtModuleLoad and related console logs for simplicity.
// The factory will now directly use process.env.NODE_ENV as it is during its execution.

export default (): ConfigObject => {
  // Determine NODE_ENV at the time the factory is called.
  // This ensures that if a test suite (like auth-flow.spec.ts) modifies
  // process.env.NODE_ENV before compiling its TestModule, that value is respected.
  const currentProcessNodeEnv = process.env.NODE_ENV || 'development';
  
  // Use Logger.debug for logging configuration details
  Logger.debug(
    `[configuration.ts factory] Factory executed. Current process.env.NODE_ENV: ${process.env.NODE_ENV}, Using effective NODE_ENV for config: ${currentProcessNodeEnv}`,
    'ConfigurationFactory',
  );

  const config = {
    NODE_ENV: currentProcessNodeEnv,
    LOG_LEVEL: (process.env.LOG_LEVEL || 'log') as LogLevel,
    PORT: parseInt(process.env.PORT || '3007', 10),
    JWT_SECRET: process.env.JWT_SECRET || 'default-jwt-secret',
    CONFIG_ENC_KEY: process.env.CONFIG_ENC_KEY || 'default-config-enc-key-32bytes12',
    REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
    API_PREFIX: process.env.API_PREFIX || 'v1',

    // Flattened Digilocker properties
    DIGILOCKER_CLIENT_ID: process.env.DIGILOCKER_CLIENT_ID || 'default-digilocker-client-id',
    DIGILOCKER_CLIENT_SECRET: process.env.DIGILOCKER_CLIENT_SECRET || 'default-digilocker-client-secret',
    DIGILOCKER_REDIRECT_URI: process.env.DIGILOCKER_REDIRECT_URI || 'http://localhost:3007/auth/callback',
    DIGILOCKER_AUTH_URL: process.env.DIGILOCKER_AUTH_URL || 'https://api.digitallocker.gov.in/public/oauth2/1/authorize',
    DIGILOCKER_TOKEN_URL: process.env.DIGILOCKER_TOKEN_URL || 'https://api.digitallocker.gov.in/public/oauth2/1/token',
    DIGILOCKER_USERINFO_URL: process.env.DIGILOCKER_USERINFO_URL || 'http://localhost:8081/userinfo',
    DIGILOCKER_API_BASE_URL: process.env.DIGILOCKER_API_BASE_URL || 'http://localhost:8082/api/v1',
    
    // Hopae hConnect API Configuration
    HOPAE_API_KEY: process.env.HOPAE_API_KEY || 'default-hopae-api-key',
    HOPAE_API_URL: process.env.HOPAE_API_URL || 'https://api.hopae.com/hconnect/v1',
    
    // Setu DigiLocker Sandbox Configuration
    SETU_CLIENT_ID: process.env.SETU_CLIENT_ID || '292c6e76-dabf-49c4-8e48-90fba2916673',
    SETU_CLIENT_SECRET: process.env.SETU_CLIENT_SECRET || '7IZMe9zvoBBuBukLiCP7n4KLwSOy11oP',
    SETU_PRODUCT_INSTANCE_ID: process.env.SETU_PRODUCT_INSTANCE_ID || 'a1104ec4-7be7-4c70-af78-f5fa72183c6a',
    SETU_DIGILOCKER_BASE_URL: process.env.SETU_DIGILOCKER_BASE_URL || 'https://dg-sandbox.setu.co',
  };
  return config;
};
