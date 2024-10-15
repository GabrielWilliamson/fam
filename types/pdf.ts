export type Conciliations = {
  userName: string;
  date: string;
  total: number;
  cordobas: number;
  dollars: number;
};

export type ChartData = {
  date: string;
  totalSum: number;
};

export type Incomes = {
  date: string;
  patient: string;
  price: number | null;
  method: string | null;
};

export type InternalDoc = {
  doctorName: string;
  doctorEspeciality: string;
  doctorCredential: string | null;
};
export type ExternalDoc = {
  doctorName: string;
  doctorEspeciality: string;
  doctorCredential: string | null;
  socials: Record<string, string> | null;
};

/*File */
export type Relative = {
  id: string;
  name: string;
  dni: string | null;
  phone: string | null;
  relation: string;
  civilStatus: string;
};
export type PediatricData = {
  infecto: string[];
  hereditary: string[];
  prenatales: Record<string, string>;
  parto: Record<string, string>;
  postnatales: Record<string, string>;
  feeding: Record<string, string>;
  psico: Record<string, boolean | string>;
  app: Record<string, string>;
};
export type GeneralData = {
  infecto: string[];
  hereditary: string[];
  Tabaco: Record<string, string>;
  Alcohol: Record<string, string>;
  Drogas: Record<string, string>;
  app: Record<string, string>;
};

/* */
export type Torax = {
  pulmonares: string | null;
  mamas: string | null;
  caja: string | null;
  cardiaco: string | null;
};
export type QueryData = {
  interrogation: string | null;
  resources: unknown[] | null;
  reason: string | null;
  history: string | null;
  observations: string | null;
  diag: string | null;
  aspects: string | null;
  skin: string | null;
  abd: string | null;
  exInf: string | null;
  exSup: string | null;
  anus: string | null;
  genitu: string | null;
  neuro: string | null;
  id: string;
  idFile: string;
  vitals: Record<string, any>;
  antropometrics: Record<string, any>;
  emergency: boolean | null;
  createdAt: unknown;
  head: Record<string, any>;
  torax: Record<string, any>;
};
export type Resource = {
  id: string;
  name: string;
};
export type Head = {
  craneo: string | null;
  ojos: string | null;
  orejas: string | null;
  nariz: string | null;
  boca: string | null;
  cuello: string | null;
};

/*patient */
export type PediatricPatient = {
  name: string;
  fileId: string;
  sex: string;
  date: string;
  origin: AddressType;
  image: string | null;
};
export type GeneralPatient = {
  name: string;
  fileId: string;
  sex: string;
  date: string;
  dni: string | null;
  phone: string | null;
  origin: AddressType;
  image: string | null;
};
export type AddressType = {
  department: string;
  nationality: string;
  municipality: string;
  address: string;
};
export type PrescriptionDetails = {
  id: string;
  drugId: string;
  tradeName: string;
  genericName: string | null;
  presentation: string;
  indications: string;
};
export type Prescription = {
  id: string;
  patientName: string;
  createdAt: Date;
};
/*prescription list */

export type PrescriptionList = Record<
  string,
  {
    createdAt: Date;
    tradeName: string;
    genericName: string | null;
    presentation: string;
    indications: string;
  }[]
>;
export type PatientPrescriptionList = {
  name: string;
  fileId: string;
};
