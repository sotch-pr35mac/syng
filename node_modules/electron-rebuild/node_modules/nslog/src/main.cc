#include "nslog.h"

#include "nan.h"
using namespace v8;

namespace {

NAN_METHOD(Log) {
  Nan::HandleScope scope;

  String::Utf8Value utf8_string(Local<String>::Cast(info[0]));
  nslog::Log(*utf8_string);

  return;
}

void Init(Handle<Object> exports) {
  Nan::SetMethod(exports, "log", Log);
}

}  // namespace

NODE_MODULE(nslog, Init)
