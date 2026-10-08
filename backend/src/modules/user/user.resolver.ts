import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { UserService } from './user.service';
import {
  User,
  UserConnection,
  UserMutationResult,
  MutationResult,
} from './entities/user.entity';
import { CreateUserInput } from './dto/create-user.dto';
import { UpdateUserInput } from './dto/update-user.dto';
import { UserFilterInput, PageInput } from './dto/user-filter.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import {
  CurrentUser,
  UserPayload,
} from '../../common/decorators/current-user.decorator';

@Resolver(() => User)
@UseGuards(JwtAuthGuard, PermissionGuard)
export class UserResolver {
  constructor(private readonly userService: UserService) {}

  @Query(() => UserConnection, { name: 'users' })
  @Permissions('user:list')
  async getUsers(
    @Args('page', { nullable: true }) page?: PageInput,
    @Args('filter', { nullable: true }) filter?: UserFilterInput,
  ): Promise<UserConnection> {
    return this.userService.findAll(
      filter || {},
      page || { page: 1, pageSize: 10 },
    );
  }

  @Query(() => User, { name: 'user' })
  @Permissions('user:view')
  async getUser(@Args('id', { type: () => ID }) id: string): Promise<User> {
    return this.userService.findById(id);
  }

  @Query(() => User, { name: 'me' })
  async getMe(@CurrentUser() user: UserPayload): Promise<User> {
    return this.userService.getMe(user.sub);
  }

  @Mutation(() => UserMutationResult)
  @Permissions('user:create')
  async createUser(
    @Args('input') input: CreateUserInput,
  ): Promise<UserMutationResult> {
    try {
      const user = await this.userService.create(input);
      return {
        success: true,
        message: '用户创建成功',
        user,
      };
    } catch (error: unknown) {
      const err = error as Error;
      return {
        success: false,
        message: err.message,
        user: undefined,
      };
    }
  }

  @Mutation(() => UserMutationResult)
  @Permissions('user:update')
  async updateUser(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateUserInput,
  ): Promise<UserMutationResult> {
    try {
      const user = await this.userService.update(id, input);
      return {
        success: true,
        message: '用户更新成功',
        user,
      };
    } catch (error: unknown) {
      const err = error as Error;
      return {
        success: false,
        message: err.message,
        user: undefined,
      };
    }
  }

  @Mutation(() => MutationResult)
  @Permissions('user:delete')
  async deleteUser(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<MutationResult> {
    try {
      await this.userService.delete(id);
      return {
        success: true,
        message: '用户删除成功',
      };
    } catch (error: unknown) {
      const err = error as Error;
      return {
        success: false,
        message: err.message,
      };
    }
  }
}
