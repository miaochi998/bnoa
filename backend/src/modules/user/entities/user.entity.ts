import { ObjectType, Field, ID } from '@nestjs/graphql';

@ObjectType()
export class User {
  @Field(() => ID)
  id: string;

  @Field()
  username: string;

  @Field()
  email: string;

  @Field()
  name: string;

  @Field({ nullable: true })
  phone?: string;

  @Field({ nullable: true })
  avatar?: string;

  @Field()
  status: string;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;

  @Field({ nullable: true })
  lastLoginAt?: Date;

  @Field(() => [String])
  roles: string[];
}

@ObjectType()
export class UserConnection {
  @Field(() => [User])
  nodes: User[];

  @Field()
  totalCount: number;

  @Field()
  page: number;

  @Field()
  pageSize: number;

  @Field()
  totalPages: number;
}

@ObjectType()
export class UserMutationResult {
  @Field()
  success: boolean;

  @Field({ nullable: true })
  message?: string;

  @Field(() => User, { nullable: true })
  user?: User;
}

@ObjectType()
export class MutationResult {
  @Field()
  success: boolean;

  @Field({ nullable: true })
  message?: string;
}
