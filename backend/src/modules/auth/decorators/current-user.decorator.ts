import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export type UserRequest = { user: any };

/**
 * 当前用户装饰器
 * 用于获取当前登录用户的信息
 */
export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<UserRequest>();

    const user = request.user;

    if (!user) {
      return null;
    }

    // 如果指定了字段名，返回该字段
    if (data) {
      return user[data];
    }

    // 否则返回整个用户对象

    return user;
  },
);
