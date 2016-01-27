{
  'target_defaults': {
    'conditions': [
      ['OS=="win"', {
        'msvs_disabled_warnings': [
          4530,  # C++ exception handler used, but unwind semantics are not enabled
          4506,  # no definition for inline function
        ],
      }],
    ],
  },
  'targets': [
    {
      'target_name': 'nslog',
      'include_dirs': [ '<!(node -e "require(\'nan\')")' ],
      'sources': [
        'src/main.cc'
      ],
      'conditions': [
        ['OS=="mac"', {
          'sources': [
            'src/nslog_mac.mm',
          ],
          'link_settings': {
            'libraries': [
              '$(SDKROOT)/System/Library/Frameworks/AppKit.framework',
            ],
          }
        }],
        ['OS=="win"', {
          'sources': [
            'src/nslog_win.cc',
          ],
        }],
        ['OS=="linux"', {
          'sources': [
            'src/nslog_linux.cc',
          ],
        }],
      ],
    }
  ]
}
