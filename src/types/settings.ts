// src/types/settings.ts
export interface UpdateProfilePayload {
  first_name: string;
  last_name: string;
  phone_number: string;
  country_of_origin: string;
  date_of_birth: string;
}

export interface IdentifyingInformation {
  type: "national-id";
  number: string;
  country: string;
}

export interface Address {
  address_line_1: string;
  city: string;
  state: string;
  postal_code: string;
  country_id: string;
}

export interface KycPayload {
  first_name: string;
  last_name: string;
  middle_name: string;
  birth_date: string;
  phone: string;
  occupation: string;
  country_id: string;
  address: Address;
  bvn: string; // NEW: Added BVN to root payload
  identifying_information: IdentifyingInformation[];
}
