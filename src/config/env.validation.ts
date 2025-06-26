import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  validateSync,
  ValidateIf,
  Matches,
  // ValidateNested, // Unused
  // Length, // Unused
  // IsNumberString, // Unused
  Allow,
} from 'class-validator';
import { Type, plainToClass } from 'class-transformer';
import { Logger } from '@nestjs/common';

enum Environment {
  Development = 'development', // Not used by NODE_ENV in this project directly but good for general use
  Mock = 'mock',
  Sandbox = 'sandbox',
  Production = 'production',
  Test = 'test', // For jest tests
}

// ADDED LogLevel enum
enum LogLevel {
  Fatal = 'fatal',
  Error = 'error',
  Warn = 'warn',
  Info = 'info',
  Debug = 'debug',
  Trace = 'trace',
}

class EnvironmentVariables {
  @IsEnum(Environment)
  NODE_ENV: Environment;

  @IsNumber()
  @Type(() => Number) // Transform string to number for validation
  PORT: number;

  // ADDED LOG_LEVEL validation
  @IsOptional()
  @IsEnum(LogLevel)
  LOG_LEVEL?: LogLevel;

  @IsNotEmpty()
  @IsString()
  JWT_SECRET: string;

  @IsNotEmpty()
  @IsString()
  // Regex for a 32-byte Base64 string (43 characters + 1 padding char '=')
  // A 32-byte string will be 44 Base64 characters. (32 * 8 / 6 = 42.66 -> ceil(42.66/4)*4 = 44)
  // For example, `openssl rand -base64 32` produces a 44-character string without an '='.
  // If it must end with `=`, it implies the original byte length was not a multiple of 3, which is fine.
  // The regex /^[A-Za-z0-9+/]{43}=$/ matches a string of 43 valid Base64 chars followed by one =.
  @Matches(/^[A-Za-z0-9+/]{43}=$/, {
    message:
      'CONFIG_ENC_KEY must be a 44-character Base64 string ending with = (32 bytes of data).',
  })
  CONFIG_ENC_KEY: string;

  @IsNotEmpty()
  @IsUrl({ require_tld: false, protocols: ['redis', 'rediss'] })
  REDIS_URL: string;

  // Nested validation for DigiLocker specific vars
  // These will be mapped from process.env.DIGILOCKER_... directly
  // For direct mapping in ConfigModule, these should be flat in EnvironmentVariables
  // or use a custom factory that constructs this nested object first.
  // For simplicity with `process.env` directly, we list them flat here
  // and will group them in the `configuration.ts` factory.

  @IsNotEmpty()
  @IsString()
  @ValidateIf(
    (o) =>
      o.NODE_ENV === Environment.Sandbox ||
      o.NODE_ENV === Environment.Production,
  )
  DIGILOCKER_CLIENT_ID: string;

  @IsNotEmpty()
  @IsString()
  @ValidateIf(
    (o) =>
      o.NODE_ENV === Environment.Sandbox ||
      o.NODE_ENV === Environment.Production,
  )
  DIGILOCKER_CLIENT_SECRET: string;

  @IsNotEmpty()
  @IsUrl({ require_tld: false })
  DIGILOCKER_REDIRECT_URI: string;

  @IsNotEmpty()
  @IsUrl({ require_tld: false })
  DIGILOCKER_AUTH_URL: string;

  @IsNotEmpty()
  @IsUrl({ require_tld: false })
  DIGILOCKER_TOKEN_URL: string;

  @IsNotEmpty()
  @IsUrl({ require_tld: false })
  DIGILOCKER_USERINFO_URL: string;

  @IsNotEmpty()
  @IsUrl({ require_tld: false })
  DIGILOCKER_API_BASE_URL: string;

  @Allow() // Added to allow the marker without validation rules
  UNIQUE_MARKER?: string;
}

const DEFAULT_CONFIG_ENC_KEY = 'CHANGE_THIS_DEFAULT_KEY_!!!!!!!!!!!!!!!!!'; // 44 chars Base64

export function validate(config: Record<string, unknown>) {
  if (!config) {
    // This case should ideally not happen if the factory always returns an object
    // but good to have a check.
    Logger.error(
      '[env.validation.ts] ERROR: Validate function did NOT receive config from factory!',
      'EnvValidation',
    );
    throw new Error('Configuration validation failed: No config object received.');
  }
  
  Logger.debug(
    `[env.validation.ts] Received for validation: ${JSON.stringify(config, null, 2)}`,
    'EnvValidation',
  );

  const validatedConfig = plainToClass(EnvironmentVariables, config, {
    enableImplicitConversion: true, // Allows PORT string to be converted by @Type(() => Number)
  });
  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false, // Ensure all defined properties are present or explicitly optional
    // forbidUnknownValues: true, // Optional: if you want to disallow any vars not in EnvironmentVariables
  });

  if (errors.length > 0) {
    // Construct a more readable error message
    const errorMessages = errors
      .map((error) => {
        return `Config validation error: ${error.property} - ${Object.values(error.constraints || {}).join(', ')}`;
      })
      .join('\n');
    throw new Error(
      `Environment configuration validation failed:\n${errorMessages}`,
    );
  }
  return validatedConfig;
}
