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

//autosave
export type querieBase = {
  querieId: string;
  interrogation: string | null;
  reason: string | null;
  history: string | null;
  observations: string | null;
  diag: string | null;
  //exam data
  aspects: string | null;
  skin: string | null;
  abd: string | null;
  exInf: string | null;
  exSup: string | null;
  anus: string | null;
  genitu: string | null;
  neuro: string | null;
};

export type resource = {
  id: string;
  url: string;
};
