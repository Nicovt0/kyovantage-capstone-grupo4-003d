export const privateQueryKeys = {
  all: (userId: string) => ['private', userId] as const,
};
