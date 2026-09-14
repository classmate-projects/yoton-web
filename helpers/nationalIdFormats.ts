// Per-country National ID document name + format, mirroring
// Yoton-API/Helpers/NationalIdFormatHelper.cs exactly - keep both in sync if this table
// changes. Lets the Reception "Create Patient" form show the right ID type (Emirates ID,
// Aadhaar Number, ...) based on the clinic's own admin-configured Company.Country
// (Settings) - not the patient's own Nationality. A UAE clinic always expects Emirates ID,
// regardless of which nationality is being registered. Countries not listed here fall back
// to a generic, unvalidated ID field. Passport Number is validated separately against one
// standard format regardless of country - passport numbering isn't standardized enough
// per-country to model here, and any patient may present a passport instead of a local ID.
export interface NationalIdFormat {
  label: string;
  regex: RegExp | null;
  placeholder: string | null;
}

const DEFAULT_FORMAT: NationalIdFormat = {
  label: "National ID",
  regex: null,
  placeholder: null,
};

export const nationalIdFormatsByCountry: Record<string, NationalIdFormat> = {
  "United Arab Emirates": {
    label: "Emirates ID",
    regex: /^784-\d{4}-\d{7}-\d{1}$/,
    placeholder: "784-1234-5678901-2",
  },
  Qatar: {
    label: "Qatar ID (QID)",
    regex: /^\d{11}$/,
    placeholder: "12345678901",
  },
  "Saudi Arabia": {
    label: "National/Iqama ID",
    regex: /^\d{10}$/,
    placeholder: "1234567890",
  },
  Kuwait: {
    label: "Civil ID",
    regex: /^\d{12}$/,
    placeholder: "123456789012",
  },
  Bahrain: {
    label: "CPR Number",
    regex: /^\d{9}$/,
    placeholder: "123456789",
  },
  Oman: {
    label: "Civil Number",
    regex: /^\d{8}$/,
    placeholder: "12345678",
  },
  India: {
    label: "Aadhaar Number",
    regex: /^\d{4}\s?\d{4}\s?\d{4}$/,
    placeholder: "1234 5678 9012",
  },
  Pakistan: {
    label: "CNIC",
    regex: /^\d{5}-\d{7}-\d{1}$/,
    placeholder: "12345-1234567-1",
  },
  Philippines: {
    label: "PhilSys Number (PSN)",
    regex: /^\d{4}-\d{4}-\d{4}$/,
    placeholder: "1234-5678-9012",
  },
  Bangladesh: {
    label: "National ID (NID)",
    regex: /^\d{10}(\d{7})?$/,
    placeholder: "1234567890",
  },
  "Sri Lanka": {
    label: "National Identity Card (NIC)",
    regex: /^(\d{9}[VXvx]|\d{12})$/,
    placeholder: "123456789V",
  },
  Egypt: {
    label: "National ID",
    regex: /^\d{14}$/,
    placeholder: "12345678901234",
  },
};

// Every nationality can present a passport, and passport numbering isn't standardized
// enough per-country to validate more precisely than this: letters and digits, 6-9
// characters (covers the common ICAO 9303 case).
export const passportNumberRegex = /^[A-Za-z0-9]{6,9}$/;

export function getNationalIdFormat(country: string | undefined | null): NationalIdFormat {
  if (country && nationalIdFormatsByCountry[country]) return nationalIdFormatsByCountry[country];
  return DEFAULT_FORMAT;
}
