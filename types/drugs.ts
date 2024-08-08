export type drugsTable = {
  id: string;
  genericName: string | null;
  tradeName: string;
  presentations: string[];
};
export type drugSearch = {
  drugId: string;
  tradeName: string;
  genericName: string | null;
  presentations: string[];
};