#include "nslog.h"

#include <iostream>

namespace nslog {

void Log(const std::string& message) {
  std::cout << message << std::endl;
}

}  // namespace nslog
