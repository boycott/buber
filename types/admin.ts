export type Participant = {
  id: string;
  name: string;
  email: string;
  preset_name: string;
  clientId?: string;
};

export type Client = {
  id: string;
  name: string;
  given_name: string;
  family_name: string;
};

export type Session = {
  id: string;
  client_id: string;
  participant_id: string;
  start_time: string;
  end_time: string;
  cost: number;
  paid: boolean;
  attendance: string;
};

export type Meeting = {
  id: string;
  name: string;
  date: string;
  participants: Participant[];
};
