-- Add a separate OTP purpose so registration codes cannot reset passwords.
ALTER TYPE "OtpPurpose" ADD VALUE 'password_reset';
