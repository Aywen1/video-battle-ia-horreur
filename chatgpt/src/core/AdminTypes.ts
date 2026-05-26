export type AdminCondition = {
  id: string;
  label: string;
  checked: boolean;
  apply: () => void;
};
