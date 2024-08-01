export type option = {
  value: string;
  label: string;
};

export type selectCountries = {
  country: string;
  countryCode: number;
  flag: string;
};

export type country = {
  country: string;
  countryCode: number;
  flag: string;
};

export type municipality = {
  name: string;
  code: string;
};

export type fulldepartments = {
  name: string;
  municipalities: municipality[];
};
