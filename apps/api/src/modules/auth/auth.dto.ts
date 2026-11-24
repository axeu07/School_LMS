import {
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";

const schoolCode = /^[A-Za-z0-9-]{2,16}$/;
const sixDigits = /^\d{6}$/;

/** Omit schoolCode to sign in to the platform (Super Admin). */
export class LoginDto {
  @IsOptional()
  @IsString()
  @Matches(schoolCode, { message: "Enter a valid school code." })
  schoolCode?: string;

  /** Email address, or a student number for students. */
  @IsString()
  @MinLength(1)
  @MaxLength(254)
  identifier!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(256)
  password!: string;
}

export class OtpRequestDto {
  @IsString()
  @Matches(schoolCode, { message: "Enter a valid school code." })
  schoolCode!: string;

  @IsString()
  @Length(8, 24)
  phone!: string;
}

export class OtpVerifyDto extends OtpRequestDto {
  @IsString()
  @Matches(sixDigits, { message: "Enter the 6-digit code." })
  code!: string;
}

export class ForgotPasswordDto {
  @IsOptional()
  @IsString()
  @Matches(schoolCode, { message: "Enter a valid school code." })
  schoolCode?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(254)
  identifier!: string;
}

export class ResetPasswordDto extends ForgotPasswordDto {
  @IsString()
  @Matches(sixDigits, { message: "Enter the 6-digit code." })
  code!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(256)
  newPassword!: string;
}

export class ChangePasswordDto {
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  currentPassword!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(256)
  newPassword!: string;
}
