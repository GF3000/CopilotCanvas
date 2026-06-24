// Customer entity — a person who places orders.

export interface CustomerProps {
  id: string;
  email: string;
  name: string;
}

export class Customer {
  constructor(private readonly props: CustomerProps) {}

  get id(): string {
    return this.props.id;
  }

  get email(): string {
    return this.props.email;
  }

  get name(): string {
    return this.props.name;
  }
}
