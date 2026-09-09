import { normalizePhone, validatePhone } from "@/lib/auth/otp/phone";

export const REGISTRATION_LIMITS = {
    firstNameMinimum: 1,
    firstNameMaximum: 50,
    lastNameMinimum: 1,
    lastNameMaximum: 50,
    emailMaximum: 254,
    phoneMaximum: 20,
    passwordMinimum: 12,
    passwordMaximum: 72,
  } as const;
  
  export type RegistrationField =
    | "firstName"
    | "lastName"
    | "email"
    | "phone"
    | "password"
    | "confirmPassword"
    | "acceptedTerms";
  
  export type RegistrationFieldErrors = Partial<
    Record<RegistrationField, string>
  >;
  
  export type RegistrationInput = {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    password: string;
    confirmPassword: string;
    acceptedTerms: boolean;
  };
  
  export type PasswordRequirements = {
    minimumLength: boolean;
    maximumLength: boolean;
    uppercase: boolean;
    lowercase: boolean;
    number: boolean;
    specialCharacter: boolean;
    noSpaces: boolean;
    validCharacters: boolean;
  };
  
  const NAME_PATTERN =
    /^[\p{L}\p{M}]+(?:[ '\u2019-][\p{L}\p{M}]+)*$/u;
  
  const EMAIL_PATTERN =
    /^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)+$/i;
  
  const PASSWORD_ALLOWED_CHARACTERS_PATTERN = /^[\x21-\x7E]+$/;
  
  export function normalizePersonName(value: string): string {
    return value.normalize("NFC").trim().replace(/\s+/g, " ");
  }
  
  export function normalizeEmail(value: string): string {
    return value.normalize("NFKC").trim().toLowerCase();
  }
  
  export function getPasswordRequirements(
    password: string,
  ): PasswordRequirements {
    return {
      minimumLength:
        password.length >= REGISTRATION_LIMITS.passwordMinimum,
      maximumLength:
        password.length <= REGISTRATION_LIMITS.passwordMaximum,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /[0-9]/.test(password),
      specialCharacter: /[^A-Za-z0-9]/.test(password),
      noSpaces: !/\s/u.test(password),
      validCharacters:
        password.length === 0 ||
        PASSWORD_ALLOWED_CHARACTERS_PATTERN.test(password),
    };
  }
  
  export function validateFirstName(
    firstName: string,
  ): string | undefined {
    if (!firstName) {
      return "First name is required.";
    }
  
    if (firstName.length < REGISTRATION_LIMITS.firstNameMinimum) {
      return "First name is too short.";
    }
  
    if (firstName.length > REGISTRATION_LIMITS.firstNameMaximum) {
      return `First name must be ${REGISTRATION_LIMITS.firstNameMaximum} characters or fewer.`;
    }
  
    if (!NAME_PATTERN.test(firstName)) {
      return "First name can contain letters, spaces, apostrophes, and hyphens only.";
    }
  
    return undefined;
  }
  
  export function validateLastName(
    lastName: string,
  ): string | undefined {
    if (!lastName) {
      return "Last name is required.";
    }
  
    if (lastName.length < REGISTRATION_LIMITS.lastNameMinimum) {
      return "Last name is too short.";
    }
  
    if (lastName.length > REGISTRATION_LIMITS.lastNameMaximum) {
      return `Last name must be ${REGISTRATION_LIMITS.lastNameMaximum} characters or fewer.`;
    }
  
    if (!NAME_PATTERN.test(lastName)) {
      return "Last name can contain letters, spaces, apostrophes, and hyphens only.";
    }
  
    return undefined;
  }
  
  export function validateEmail(
    email: string,
  ): string | undefined {
    if (!email) {
      return "Email is required.";
    }
  
    if (email.length > REGISTRATION_LIMITS.emailMaximum) {
      return "Email address is too long.";
    }
  
    if (/\s/u.test(email) || !EMAIL_PATTERN.test(email)) {
      return "Enter a valid email address.";
    }
  
    const [localPart] = email.split("@");
  
    if (
      !localPart ||
      localPart.length > 64 ||
      localPart.startsWith(".") ||
      localPart.endsWith(".") ||
      localPart.includes("..")
    ) {
      return "Enter a valid email address.";
    }
  
    return undefined;
  }
  
  export function validatePassword(
    password: string,
  ): string | undefined {
    if (!password) {
      return "Password is required.";
    }
  
    const requirements = getPasswordRequirements(password);
  
    if (!requirements.minimumLength) {
      return `Password must be at least ${REGISTRATION_LIMITS.passwordMinimum} characters.`;
    }
  
    if (!requirements.maximumLength) {
      return `Password must be ${REGISTRATION_LIMITS.passwordMaximum} characters or fewer.`;
    }
  
    if (!requirements.noSpaces) {
      return "Password cannot contain spaces.";
    }
  
    if (!requirements.validCharacters) {
      return "Password contains unsupported characters.";
    }
  
    if (!requirements.uppercase) {
      return "Password must include an uppercase letter.";
    }
  
    if (!requirements.lowercase) {
      return "Password must include a lowercase letter.";
    }
  
    if (!requirements.number) {
      return "Password must include a number.";
    }
  
    if (!requirements.specialCharacter) {
      return "Password must include a special character.";
    }
  
    return undefined;
  }
  
  export function validateRegistrationInput(
    input: RegistrationInput,
  ): {
    data: RegistrationInput;
    errors: RegistrationFieldErrors;
  } {
    const data: RegistrationInput = {
      firstName: normalizePersonName(input.firstName),
      lastName: normalizePersonName(input.lastName),
      email: normalizeEmail(input.email),
      phone: normalizePhone(input.phone) ?? input.phone.trim(),
      password: input.password,
      confirmPassword: input.confirmPassword,
      acceptedTerms: input.acceptedTerms === true,
    };
  
    const errors: RegistrationFieldErrors = {};
  
    const firstNameError = validateFirstName(data.firstName);
    const lastNameError = validateLastName(data.lastName);
    const emailError = validateEmail(data.email);
    const phoneError = validatePhone(input.phone);
    const passwordError = validatePassword(data.password);
  
    if (firstNameError) {
      errors.firstName = firstNameError;
    }
  
    if (lastNameError) {
      errors.lastName = lastNameError;
    }
  
    if (emailError) {
      errors.email = emailError;
    }

    if (phoneError) {
      errors.phone = phoneError;
    }
  
    if (passwordError) {
      errors.password = passwordError;
    }
  
    if (!data.confirmPassword) {
      errors.confirmPassword = "Confirm your password.";
    } else if (data.password !== data.confirmPassword) {
      errors.confirmPassword = "Passwords do not match.";
    }
  
    if (!data.acceptedTerms) {
      errors.acceptedTerms =
        "You must agree to the Terms and Privacy Policy.";
    }
  
    return {
      data,
      errors,
    };
  }
  
  export function isRegistrationInput(
    value: unknown,
  ): value is RegistrationInput {
    if (!value || typeof value !== "object") {
      return false;
    }
  
    const input = value as Record<string, unknown>;
  
    return (
      typeof input.firstName === "string" &&
      typeof input.lastName === "string" &&
      typeof input.email === "string" &&
      typeof input.phone === "string" &&
      typeof input.password === "string" &&
      typeof input.confirmPassword === "string" &&
      typeof input.acceptedTerms === "boolean"
    );
  }
  
  export function hasRegistrationErrors(
    errors: RegistrationFieldErrors,
  ): boolean {
    return Object.keys(errors).length > 0;
  }