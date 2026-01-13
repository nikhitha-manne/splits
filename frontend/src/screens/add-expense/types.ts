export type ContainerType = 'group' | 'direct';

export interface UserInfo {
  uid: string;
  name: string;
  email: string;
  defaultCurrency: string;
}

export interface Payer {
  userId: string;
  amount: number;
}
