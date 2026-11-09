// src/types/settings.ts
export interface UpdateProfilePayload {
  first_name: string;
  last_name: string;
  phone_number: string;
  country_of_origin: string;
  date_of_birth: string;
}

export type IdentifyingInformation =
  | { type: "national-id"; number: string; country: string }
  | { type: "selfie"; country: string };

export interface Address {
  address_line_1: string;
  city: string;
  state: string;
  postal_code: string;
  country_id: string;
}

export interface KycPayload {
  type: string; // e.g., "individual"
  email: string;
  first_name: string;
  last_name: string;
  middle_name: string;
  birth_date: string;
  phone: string;
  occupation: string;
  country_id: string;
  address: Address;
  bvn: string;
  identifying_information: IdentifyingInformation[];
  has_accepted_terms: boolean;
}
