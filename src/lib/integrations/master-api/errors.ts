export class MasterApiInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MasterApiInputError";
  }
}

export class MasterApiConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MasterApiConflictError";
  }
}

export class MasterApiUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MasterApiUnavailableError";
  }
}
