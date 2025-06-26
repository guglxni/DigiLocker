export interface DigiLockerUserProfile {
  // Common OAuth userinfo claims (can vary based on provider & scope)
  sub: string; // Subject - The End-User's locally unique and never reassigned identifier
  name?: string; // End-User's full name
  given_name?: string; // Given name(s) or first name(s) of the End-User
  family_name?: string; // Surname(s) or last name(s) of the End-User
  middle_name?: string; // Middle name(s) of the End-User
  nickname?: string; // Casual name of the End-User
  preferred_username?: string; // Shorthand name by which the End-User wishes to be referred to
  profile?: string; // URL of the End-User's profile page
  picture?: string; // URL of the End-User's profile picture
  website?: string; // URL of the End-User's Web page or blog
  email?: string; // End-User's preferred e-mail address
  email_verified?: boolean; // True if the End-User's e-mail address has been verified
  gender?: string; // End-User's gender
  birthdate?: string; // End-User's birthday, represented as an ISO 8601:2004 [ISO8601‑2004] YYYY-MM-DD format
  zoneinfo?: string; // String from zoneinfo [zoneinfo] time zone database representing the End-User's time zone
  locale?: string; // End-User's locale, represented as a BCP47 [RFC5646] language tag
  phone_number?: string; // End-User's preferred telephone number
  phone_number_verified?: boolean; // True if the End-User's phone number has been verified
  address?: AddressClaim; // End-User's preferred postal address
  updated_at?: number; // Time the End-User's information was last updated

  // DigiLocker specific claims (based on typical DigiLocker responses)
  digilockerid?: string; // DigiLocker ID
  dob?: string; // Date of Birth (often in DD-MM-YYYY or YYYY-MM-DD)
  eaadhaar?: string; // 'Y' or 'N' if eAadhaar is linked
  reference_key?: string; // A reference key
  mobileno?: string; // Mobile number
  aadhaarlast4digit?: string; // Last 4 digits of Aadhaar
  xml?: string; // Sometimes the full eAadhaar XML is returned if scope permits

  // Add other fields as per actual DigiLocker UserInfo API response and granted scopes
  // These can be quite variable based on what DigiLocker version/API endpoint is hit.
  // It's best to inspect an actual response from the sandbox.
}

export interface AddressClaim {
  formatted?: string;
  street_address?: string;
  locality?: string;
  region?: string;
  postal_code?: string;
  country?: string;
}
