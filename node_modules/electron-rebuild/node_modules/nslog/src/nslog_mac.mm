#include "nslog.h"

#import <Foundation/Foundation.h>

namespace nslog {

void Log(const std::string& message) {
  NSLog(@"%s", message.c_str());
}

}  // namespace nslog
