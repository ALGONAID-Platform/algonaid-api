import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { CURRENT_USER_KEY } from "src/utils/conistants";
import { JwtPayloadType } from "src/utils/types";

export const CurrentUser = createParamDecorator(
    (data, context: ExecutionContext) => {
        const request = context.switchToHttp().getRequest();
        const user: JwtPayloadType = request[CURRENT_USER_KEY];
        return user ;
    }
)