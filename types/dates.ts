export type CurrentDate = {
  id: string;
  start: Date;
  end: Date;
  querieId: string;
  patient: string;
  patientId: string;
};

import { Event } from "react-big-calendar";

export interface IEvents extends Event {
  id: string;
  patient: string | null;
  patientId: string | null;
  eventId: string | null;
  eventTitle: string | null;
}
