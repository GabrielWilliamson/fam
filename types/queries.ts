

export type headType = {
  craneo: string | undefined;
  ojos: string | undefined;
  orejas: string | undefined;
  nariz: string | undefined;
  boca: string | undefined;
  cuello: string | undefined;
};

export type torazType = {
  caja: string | undefined;
  mamas: string | undefined;
  cardiaco: string | undefined;
  pulmonares: string | undefined;
};

export type querieType = {
  id: string;
  idFile: string;
  examId: string | null;
  currentHistory: string | null;
  emergency: boolean;  
  observations: string | null;
  diagnosis: string | null;
  price: number | null;
  paymentStatus: boolean;
  prescriptionsId: string | null;
  createdAt: string;
  doctorsId: string;
  name: string;
};

export type resource = {
  id: string;
  url: string;
};