export type EmploymentType = 'salaried' | 'priest' | 'wage' | 'honorary';

export interface EmployeeSummary {
  id: string;
  name: string;
  designation: string | null;
  employmentType: EmploymentType;
  monthlySalary: string | null;
  phone: string | null;
  email: string | null;
  joinedOn: string | null;
  isActive: boolean;
  /** Derived — salary/honorarium vouchers paid to this employee this FY. */
  paidThisFy: string;
  /** Derived — date of the most recent recorded payment, if any. */
  lastPaidAt: Date | null;
}

export interface EmployeePayment {
  id: string;
  voucherNumber: string;
  amount: string;
  categoryName: string | null;
  at: Date;
}

export interface EmployeeDetail {
  employee: EmployeeSummary;
  payments: EmployeePayment[];
}

export interface PayrollStats {
  currency: 'INR' | 'BDT';
  activeCount: number;
  /** Sum of expected monthly salaries across active staff. */
  monthlyPayroll: string;
  /** Total salary/honorarium paid so far this financial year. */
  paidThisFy: string;
}
