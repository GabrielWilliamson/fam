export type tablePatients = {
  id: string;
  fileId: string;
  name: string;
  dni: string | null;
  origin: string;
  date: string;
  address: string | null;
  sex: string;
  phone: number | null;
  createdAt: string;
};

export type smsTable = {
  id: string;
  name: string;
  phone: string;
  isPatient: boolean;
  relative: string;
};

export type addressType = {
  department: string;
  nationality: string;
  municipality: string;
  address: string;
};

export type patientFile = {
  id: string;
  fileId: string;
  name: string;
  dni: string | null;
  country: string;
  dapartment: string;
  municipaly: string;
  age: string;
  date: Date;
  address: string;
  sex: string;
  phone: string | null;
  createdAt: Date;
};

export type searchPatient = {
  id: string;
  fileId: string;
  name: string;
};
