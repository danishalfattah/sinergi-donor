import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';

interface MessageEnvelope<T> {
  data: T;
  message?: string;
}

@Injectable()
export class ResponseInterceptor<T>
  implements NestInterceptor<T, { success: true; data: T; message?: string }>
{
  intercept(
    _context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<{ success: true; data: T; message?: string }> {
    return next.handle().pipe(
      map((value) => {
        if (this.isMessageEnvelope(value)) {
          return {
            success: true as const,
            data: value.data,
            message: value.message,
          };
        }

        return {
          success: true as const,
          data: value,
        };
      }),
    );
  }

  private isMessageEnvelope(value: unknown): value is MessageEnvelope<T> {
    return (
      typeof value === 'object' &&
      value !== null &&
      'data' in value &&
      Object.keys(value).every((key) => key === 'data' || key === 'message')
    );
  }
}
